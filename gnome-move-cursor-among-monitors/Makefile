UUID = move-cursor-among-monitors@tanzhenyu

.PHONY: check pack install clean
check:
	glib-compile-schemas --strict --dry-run schemas
	gjs -m tests/geometry.test.js
	GSETTINGS_BACKEND=memory gjs -m tests/preferences.test.js

pack: check
	mkdir -p dist
	gnome-extensions pack --force --extra-source=geometry.js --extra-source=i18n.js --extra-source=conflicts.js --extra-source=LICENSE --out-dir=dist .
	unzip -t dist/$(UUID).shell-extension.zip

install: pack
	gnome-extensions install --force dist/$(UUID).shell-extension.zip
	@echo 'Log out and back in if this is the first installation, then run:'
	@echo 'gnome-extensions enable $(UUID)'
	@echo 'gnome-extensions prefs $(UUID)'

clean:
	rm -rf dist schemas/gschemas.compiled
