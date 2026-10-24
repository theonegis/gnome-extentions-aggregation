/* Exercise the real helper state transitions with a pipe replacing uinput. */
#define main helper_main
#include "../src/three-finger-drag.c"
#undef main
#undef NDEBUG
#include <assert.h>

int main(void) {
    int fds[2];
    assert(pipe(fds) == 0);
    uinput_fd = fds[1];
    delay_override = true;
    release_delay_ms = 3000;
    begin_drag();
    assert(dragging && !release_at);
    end_drag(1000, false);
    assert(dragging && release_at == 4000);
    expire_drag(3999);
    assert(dragging);
    begin_drag(); /* Resume must not send a second press. */
    assert(dragging && !release_at);
    expire_drag(5000);
    assert(dragging);
    end_drag(6000, false);
    expire_drag(9000);
    assert(!dragging && !release_at);
    struct input_event events[4];
    assert(read(fds[0], events, sizeof(events)) == sizeof(events));
    assert(events[0].type == EV_KEY && events[0].value == 1);
    assert(events[2].type == EV_KEY && events[2].value == 0);
    release_delay_ms = 0;
    begin_drag();
    end_drag(10000, false);
    assert(!dragging);
    release_delay_ms = 3000;
    begin_drag();
    end_drag(11000, true); /* Cancelled gestures never latch. */
    assert(!dragging);
    begin_drag();
    end_drag(12000, false);
    release_drag(); /* Tap/disable/exit use the same immediate-release path. */
    assert(!dragging && !release_at);
    close(fds[0]);
    close(fds[1]);

    /* Regression: single-finger motion during the delay releases immediately,
     * while motion outside the pending state cannot interrupt a live swipe. */
    assert(pipe(fds) == 0);
    uinput_fd = fds[1];
    begin_drag();
    cancel_pending_drag(NULL);
    assert(dragging && !release_at);
    end_drag(13000, false);
    assert(release_at == 16000);
    cancel_pending_drag(NULL);
    assert(!dragging && !release_at);
    assert(read(fds[0], events, sizeof(events)) == sizeof(events));
    assert(events[0].type == EV_KEY && events[0].code == BTN_LEFT && events[0].value == 1);
    assert(events[2].type == EV_KEY && events[2].code == BTN_LEFT && events[2].value == 0);
    /* A new swipe after cancellation must start with a new button press. */
    begin_drag();
    assert(dragging);
    release_drag();
    assert(read(fds[0], events, sizeof(events)) == sizeof(events));
    assert(events[0].value == 1 && events[2].value == 0);
    close(fds[0]);
    close(fds[1]);
    return 0;
}
