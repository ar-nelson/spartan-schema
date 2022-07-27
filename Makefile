.PHONY: all npm check test clean

VERSION=1.0.0

all: npm
npm: test
	deno run -A scripts/build_npm.ts $(VERSION)
test: check
	deno test test
check:
	deno fmt
	deno lint
clean:
	rm -rf build
