#define _GNU_SOURCE

#include <errno.h>
#include <fcntl.h>
#include <getopt.h>
#include <libinput.h>
#include <linux/uinput.h>
#include <poll.h>
#include <signal.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <unistd.h>
#include <libudev.h>
#include <math.h>
#include <stdint.h>
#include <time.h>
#include <limits.h>

static volatile sig_atomic_t running = 1;
static int uinput_fd = -1;
static bool dragging = false;
static double speed = 1.0;
static double remainder_x = 0.0, remainder_y = 0.0;
enum { DEFAULT_RELEASE_DELAY_MS = 2000 };
static int release_delay_ms = DEFAULT_RELEASE_DELAY_MS;
static bool delay_override = false;
static int64_t release_at = 0;
static struct libinput_device *drag_device = NULL;

static int64_t now_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (int64_t)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}

/* Preferences writes this small file atomically. Read at each gesture end so
 * changing the setting needs neither a service restart nor a Shell reload. */
static int configured_delay(void) {
    if (delay_override) return release_delay_ms;
    char path[PATH_MAX];
    const char *config = getenv("XDG_CONFIG_HOME");
    const char *home_dir = getenv("HOME");
    int length;
    if (config && *config)
        length = snprintf(path, sizeof(path), "%s/gnome-three-finger-drag/release-delay-ms", config);
    else if (home_dir)
        length = snprintf(path, sizeof(path), "%s/.config/gnome-three-finger-drag/release-delay-ms", home_dir);
    else return DEFAULT_RELEASE_DELAY_MS;
    if (length < 0 || (size_t)length >= sizeof(path)) return DEFAULT_RELEASE_DELAY_MS;
    FILE *file = fopen(path, "r");
    if (!file) return DEFAULT_RELEASE_DELAY_MS;
    int delay;
    char extra;
    int count = fscanf(file, "%d %c", &delay, &extra);
    fclose(file);
    return count == 1 && delay >= 0 && delay <= 10000 ? delay : DEFAULT_RELEASE_DELAY_MS;
}

static void emit_event(unsigned short type, unsigned short code, int value) {
    struct input_event event = {.type = type, .code = code, .value = value};
    if (write(uinput_fd, &event, sizeof(event)) != (ssize_t)sizeof(event))
        fprintf(stderr, "uinput write failed: %s\n", strerror(errno));
}

static void sync_events(void) { emit_event(EV_SYN, SYN_REPORT, 0); }

static void release_drag(void) {
    if (!dragging || uinput_fd < 0)
        return;
    emit_event(EV_KEY, BTN_LEFT, 0);
    sync_events();
    dragging = false;
    release_at = 0;
    if (drag_device) drag_device = libinput_device_unref(drag_device);
    remainder_x = remainder_y = 0.0;
}

static void begin_drag(void) {
    release_at = 0;
    if (dragging) return;
    emit_event(EV_KEY, BTN_LEFT, 1);
    sync_events();
    dragging = true;
}

static void end_drag(int64_t now, bool cancelled) {
    if (!dragging) return;
    int delay = configured_delay();
    if (cancelled || delay == 0) release_drag();
    else release_at = now + delay;
}

static void expire_drag(int64_t now) {
    if (release_at && now >= release_at) release_drag();
}

static void cancel_pending_drag(struct libinput_device *device) {
    if (release_at && device == drag_device)
        release_drag();
}

static void handle_signal(int sig) {
    (void)sig;
    running = 0;
}

static int open_restricted(const char *path, int flags, void *user_data) {
    (void)user_data;
    int fd = open(path, flags | O_CLOEXEC);
    return fd < 0 ? -errno : fd;
}

static void close_restricted(int fd, void *user_data) {
    (void)user_data;
    close(fd);
}

static const struct libinput_interface interface = {
    .open_restricted = open_restricted,
    .close_restricted = close_restricted,
};

static int create_virtual_mouse(void) {
    int fd = open("/dev/uinput", O_WRONLY | O_NONBLOCK | O_CLOEXEC);
    if (fd < 0)
        return -1;

    if (ioctl(fd, UI_SET_EVBIT, EV_KEY) < 0 ||
        ioctl(fd, UI_SET_KEYBIT, BTN_LEFT) < 0 ||
        ioctl(fd, UI_SET_EVBIT, EV_REL) < 0 ||
        ioctl(fd, UI_SET_RELBIT, REL_X) < 0 ||
        ioctl(fd, UI_SET_RELBIT, REL_Y) < 0) {
        close(fd);
        return -1;
    }

    struct uinput_setup setup = {0};
    snprintf(setup.name, UINPUT_MAX_NAME_SIZE, "GNOME Three Finger Drag");
    setup.id.bustype = BUS_VIRTUAL;
    setup.id.vendor = 0x1;
    setup.id.product = 0x1;
    setup.id.version = 1;
    if (ioctl(fd, UI_DEV_SETUP, &setup) < 0 || ioctl(fd, UI_DEV_CREATE) < 0) {
        close(fd);
        return -1;
    }
    return fd;
}

static int rounded_delta(double value, double *remainder) {
    double total = value * speed + *remainder;
    int whole = (int)total;
    *remainder = total - whole;
    return whole;
}

static void process_event(struct libinput_event *event) {
    enum libinput_event_type type = libinput_event_get_type(event);
    struct libinput_device *device = libinput_event_get_device(event);
    if (type == LIBINPUT_EVENT_DEVICE_ADDED) {
        if (libinput_device_has_capability(device, LIBINPUT_DEVICE_CAP_GESTURE)) {
            /* This enables tap recognition only in our private context. We do
             * not forward button events or modify the compositor's settings. */
            libinput_device_config_tap_set_enabled(device, LIBINPUT_CONFIG_TAP_ENABLED);
            libinput_device_config_tap_set_drag_enabled(device, LIBINPUT_CONFIG_DRAG_DISABLED);
        }
        return;
    }
    if (type == LIBINPUT_EVENT_DEVICE_REMOVED && device == drag_device) {
        release_drag();
        return;
    }
    if (type == LIBINPUT_EVENT_POINTER_MOTION) {
        /* The compositor handles normal one-finger motion independently.
         * Release our held button as soon as that motion reaches this context,
         * instead of letting it drag until the resume timeout expires. */
        cancel_pending_drag(device);
        return;
    }
    if (type == LIBINPUT_EVENT_POINTER_BUTTON) {
        struct libinput_event_pointer *pointer = libinput_event_get_pointer_event(event);
        if (libinput_event_pointer_get_button_state(pointer) == LIBINPUT_BUTTON_STATE_PRESSED)
            cancel_pending_drag(device);
        return;
    }
    if (type != LIBINPUT_EVENT_GESTURE_SWIPE_BEGIN &&
        type != LIBINPUT_EVENT_GESTURE_SWIPE_UPDATE &&
        type != LIBINPUT_EVENT_GESTURE_SWIPE_END)
        return;

    struct libinput_event_gesture *gesture = libinput_event_get_gesture_event(event);
    if (libinput_event_gesture_get_finger_count(gesture) != 3)
        return;

    if (type == LIBINPUT_EVENT_GESTURE_SWIPE_BEGIN) {
        if (drag_device && drag_device != device) release_drag();
        begin_drag();
        if (!drag_device) drag_device = libinput_device_ref(device);
    } else if (type == LIBINPUT_EVENT_GESTURE_SWIPE_UPDATE && dragging && device == drag_device) {
        int dx = rounded_delta(libinput_event_gesture_get_dx(gesture), &remainder_x);
        int dy = rounded_delta(libinput_event_gesture_get_dy(gesture), &remainder_y);
        if (dx) emit_event(EV_REL, REL_X, dx);
        if (dy) emit_event(EV_REL, REL_Y, dy);
        if (dx || dy) sync_events();
    } else if (type == LIBINPUT_EVENT_GESTURE_SWIPE_END && device == drag_device) {
        end_drag(now_ms(), libinput_event_gesture_get_cancelled(gesture));
    }
}

static void usage(const char *program) {
    fprintf(stderr, "Usage: %s [--speed FACTOR] [--release-delay SECONDS (0..10)]\n", program);
}

int main(int argc, char **argv) {
    static const struct option options[] = {
        {"speed", required_argument, NULL, 's'},
        {"release-delay", required_argument, NULL, 'd'},
        {"help", no_argument, NULL, 'h'},
        {NULL, 0, NULL, 0},
    };
    int option;
    while ((option = getopt_long(argc, argv, "s:d:h", options, NULL)) != -1) {
        if (option == 'd') {
            char *end;
            double delay = strtod(optarg, &end);
            if (end == optarg || *end || !isfinite(delay) || delay < 0 || delay > 10) {
                fprintf(stderr, "release delay must be in [0, 10] seconds\n");
                return EXIT_FAILURE;
            }
            release_delay_ms = (int)(delay * 1000);
            delay_override = true;
            continue;
        }
        if (option == 's') {
            char *end = NULL;
            speed = strtod(optarg, &end);
            if (end == optarg || *end || !isfinite(speed) || speed <= 0.0 || speed > 10.0) {
                fprintf(stderr, "speed must be in (0, 10]\n");
                return EXIT_FAILURE;
            }
        } else {
            usage(argv[0]);
            return option == 'h' ? EXIT_SUCCESS : EXIT_FAILURE;
        }
    }

    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);
    signal(SIGHUP, handle_signal);

    uinput_fd = create_virtual_mouse();
    if (uinput_fd < 0) {
        fprintf(stderr, "cannot create /dev/uinput device: %s\n", strerror(errno));
        return EXIT_FAILURE;
    }

    struct udev *udev = udev_new();
    struct libinput *li = udev ? libinput_udev_create_context(&interface, NULL, udev) : NULL;
    if (!li || libinput_udev_assign_seat(li, "seat0") != 0) {
        fprintf(stderr, "cannot open libinput seat0 (check /dev/input permissions)\n");
        if (li) libinput_unref(li);
        if (udev) udev_unref(udev);
        ioctl(uinput_fd, UI_DEV_DESTROY);
        close(uinput_fd);
        return EXIT_FAILURE;
    }

    struct pollfd pollfd = {.fd = libinput_get_fd(li), .events = POLLIN};
    while (running) {
        expire_drag(now_ms());
        libinput_dispatch(li);
        struct libinput_event *event;
        while ((event = libinput_get_event(li)) != NULL) {
            process_event(event);
            libinput_event_destroy(event);
        }
        expire_drag(now_ms());
        /* Bound the idle wait to avoid the signal-before-poll shutdown race. */
        int timeout = 100;
        if (release_at) {
            int64_t remaining = release_at - now_ms();
            if (remaining < timeout) timeout = remaining > 0 ? (int)remaining : 0;
        }
        if (running && poll(&pollfd, 1, timeout) < 0 && errno != EINTR) {
            fprintf(stderr, "poll failed: %s\n", strerror(errno));
            break;
        }
    }

    release_drag();
    libinput_unref(li);
    udev_unref(udev);
    ioctl(uinput_fd, UI_DEV_DESTROY);
    close(uinput_fd);
    return EXIT_SUCCESS;
}
