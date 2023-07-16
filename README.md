# Kotonoha!

A simple, entirely client-side dictionary currently based on the JMdict dataset.

View on GitHub Pages! https://moshikoi.github.io/Kotonoha/

# Features

 - Dictionary based on JMdict
 - Sentence parser powered by [mecab-wasm](https://github.com/itayperl/mecab-wasm)
 - Example sentences from [massif.la](http://massif.la/ja)

# Todo

 - Pagination - currently very laggy/freezes when loading too many entries, making it unusable
 - Better ordering of results
 - Unidic pitch accents
 - Stablize the database generation tools

# Deploying

Following [this guide](https://gist.github.com/cobyism/4730490), to deploy the site to GitHub Pages, run the following

```
git subtree push --prefix pages origin gh-pages
```