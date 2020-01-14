github:
	rm -rf docs
	cp -r public/ docs
	git add -A
	git commit -m "deploy github pages"
	git push