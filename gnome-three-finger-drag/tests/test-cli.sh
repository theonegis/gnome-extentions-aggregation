#!/bin/sh
set -eu

helper=$1

for delay in -1 11 nan inf '' invalid; do
    set +e
    output=$("$helper" --release-delay "$delay" 2>&1)
    result=$?
    set -e
    [ "$result" -eq 1 ]
    case "$output" in
        *'release delay must be'*) ;;
        *) echo "Unexpected validation result: $output" >&2; exit 1 ;;
    esac
done
"$helper" --release-delay 3 --help >/dev/null 2>&1
"$helper" --release-delay 0 --help >/dev/null 2>&1

"$helper" --help >/dev/null 2>&1

if "$helper" --speed 0 >/dev/null 2>&1; then
    echo 'zero speed was unexpectedly accepted' >&2
    exit 1
fi

if "$helper" --speed fast >/dev/null 2>&1; then
    echo 'nonnumeric speed was unexpectedly accepted' >&2
    exit 1
fi
