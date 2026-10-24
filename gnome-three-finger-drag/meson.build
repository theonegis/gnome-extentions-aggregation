project(
  'gnome-three-finger-drag',
  'c',
  version: '0.1.0',
  meson_version: '>= 0.55.0',
  default_options: ['warning_level=3', 'c_std=c11'],
)

libinput_dep = dependency('libinput', version: '>= 1.19')
libudev_dep = dependency('libudev')

drag_test = executable('test-drag', 'tests/test-drag.c',
  dependencies: [libinput_dep, libudev_dep])
test('drag-lifecycle', drag_test)

helper = executable(
  'gnome-three-finger-drag',
  'src/three-finger-drag.c',
  dependencies: [libinput_dep, libudev_dep],
  install: true,
)

test(
  'command-line-interface',
  find_program('tests/test-cli.sh'),
  args: [helper.full_path()],
)

install_data(
  'systemd/gnome-three-finger-drag.service',
  install_dir: get_option('prefix') / 'share/systemd/user',
)
