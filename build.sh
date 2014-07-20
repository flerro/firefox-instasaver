#!/bin/bash
APP_NAME="instasaver"
CHROME_COMPONENTS="content locale skin defaults"
TMP_DIR="build"

if [ -z $APP_NAME ]; then
  echo "Missing app name"
  exit 1;
fi

ROOT_DIR=`pwd`

# remove any left-over files from previous build
rm -f *.jar *.xpi chrome.files
rm -rf $TMP_DIR

# MAKE Jar
mkdir -p $TMP_DIR/chrome
JAR=$TMP_DIR"/chrome/"$APP_NAME".jar"

echo "Building "$JAR"..."
for D in $CHROME_COMPONENTS
do
	find $D -type f -print | grep -v '/\.' >> chrome.files
done

zip -0 -r $JAR `cat chrome.files`

cp install.rdf $TMP_DIR
cp chrome.jar.manifest $TMP_DIR/chrome.manifest

echo "Generating "$APP_NAME".xpi..."
cd $TMP_DIR
zip -r ../$APP_NAME.xpi *

cd ..

rm -f $APP_NAME.jar chrome.files
rm -rf $TMP_DIR

echo "Done"