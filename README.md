# Kotonoha!

A simple, entirely client-side dictionary currently based on the JMdict dataset.

View on GitHub Pages! https://moshikoi.github.io/Kotonoha/

# Features

 - Dictionary based on JMdict and Wiktionary
 - Sentence parser powered by UniDic
 - Example sentences from [massif.la](http://massif.la/ja)

# Todo

 - Better ordering of results
 - Unidic pitch accents
 - Stablize the database generation tools

# Deploying

Following [this guide](https://gist.github.com/cobyism/4730490), to deploy the site to GitHub Pages, run the following

```
git subtree push --prefix pages origin gh-pages
```

# Licence information

The licences for libraries used are copied into the `licences` folder, with file names corresponding with the library.

sql.js is used under the MIT licence

Parts of UniDic 2.1.2 in a compressed format are included in the `unidic` folder, and are used under the terms of the BSD Licence file in that folder.