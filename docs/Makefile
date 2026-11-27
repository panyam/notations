
NUM_LINKED_GOMODS=`cat go.mod | grep -v "^\/\/" | grep replace | wc -l | sed -e "s/ *//g"`

all: build run

run:
	# cp ../secrets/notations/.env /tmp
	# cp ../secrets/notations/.env.dev /tmp
	NOTATIONS_DOCS_ENV=dev NOTATIONS_DOCS_PORT=:8085 go run .

webpack:
	cd .. && npm run build:docs

checklinks:
	@if [ x"${NUM_LINKED_GOMODS}" != "x0" ]; then	\
		echo "You are trying to deploying with symlinks.  Remove them first and make sure versions exist" && false ;	\
	fi

build: resymlink webpack

resymlink:
	mkdir -p locallinks
	rm -Rf locallinks/*
	cd locallinks && ln -s ../../../../golang/templar
	cd locallinks && ln -s ../../../../golang/goutils
	cd locallinks && ln -s ../../../../golang/oneauth
	cd locallinks && ln -s ../../../../golang/s3gen

# Production site in dist/docs, without deploying.
site: webpack render

# Renders the pages, copies static/ (s3gen doesn't in build mode), and builds the Pagefind search
# index into dist/docs/pagefind. The Docs workflow runs this target after its own webpack build.
render:
	NOTATIONS_DOCS_ENV=production go run main.go -build
	rm -Rf dist/docs/static
	cp -r static dist/docs
	pnpm exec pagefind --site dist/docs
	touch dist/docs/.nojekyll

# GitHub Pages deploys from the Docs workflow after CI passes on master.
# This runs it now, on master as it is on GitHub.
deploy:
	gh workflow run docs.yml --ref master
	@echo "Started. Follow it with: gh run watch"
