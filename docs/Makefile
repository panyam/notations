
NUM_LINKED_GOMODS=`cat go.mod | grep -v "^\/\/" | grep replace | wc -l | sed -e "s/ *//g"`

all: build run

run:
	# cp ../secrets/notations/.env /tmp 
	# cp ../secrets/notations/.env.dev /tmp
	NOTATIONS_ENV=dev NOTATIONS_DOCS_PORT=:8085 go run .

checklinks:
	@if [ x"${NUM_LINKED_GOMODS}" != "x0" ]; then	\
		echo "You are trying to deploying with symlinks.  Remove them first and make sure versions exist" && false ;	\
	fi

deploy: checklinks build
	gcloud app deploy --project notations --verbosity=info

build: resymlink

resymlink:
	mkdir -p locallinks
	rm -Rf locallinks/*
	cd locallinks && ln -s ../../../../golang/templar
	cd locallinks && ln -s ../../../../golang/goutils
	cd locallinks && ln -s ../../../../golang/oneauth
	cd locallinks && ln -s ../../../../golang/s3gen
