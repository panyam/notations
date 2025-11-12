
NUM_LINKED_GOMODS=`cat go.mod | grep -v "^\/\/" | grep replace | wc -l | sed -e "s/ *//g"`

all: build run

run:
	# cp ../secrets/notations/.env /tmp
	# cp ../secrets/notations/.env.dev /tmp
	NOTATIONS_ENV=dev NOTATIONS_DOCS_PORT=:8085 go run .

webpack:
	pnpm build

checklinks:
	@if [ x"${NUM_LINKED_GOMODS}" != "x0" ]; then	\
		echo "You are trying to deploying with symlinks.  Remove them first and make sure versions exist" && false ;	\
	fi

deploy: checklinks build
	gcloud app deploy --project notations --verbosity=info

build: resymlink webpack

resymlink:
	mkdir -p locallinks
	rm -Rf locallinks/*
	cd locallinks && ln -s ../../../../golang/templar
	cd locallinks && ln -s ../../../../golang/goutils
	cd locallinks && ln -s ../../../../golang/oneauth
	cd locallinks && ln -s ../../../../golang/s3gen

# GitHub Pages deployment
gh-pages: build
	@echo "Building production site..."
	@NOTATIONS_ENV=production go run main.go -build
	@echo "Deploying to gh-pages branch..."
	@if [ -d dist/docs/.git ]; then \
		echo "Error: dist/docs appears to be a git repo. Please remove it first."; \
		exit 1; \
	fi
	@cd dist/docs && \
		touch .nojekyll && \
		git init && \
		git add -A && \
		git commit -m "Deploy to GitHub Pages" && \
		git branch -M gh-pages && \
		git remote add origin git@panyam-github:panyam/notations.git && \
		git push -f origin gh-pages
	@echo "Deployed! Enable GitHub Pages in repo settings to serve from gh-pages branch"
	@rm -rf dist/docs/.git
