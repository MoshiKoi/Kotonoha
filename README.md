# Kotonoha!

A simple, entirely client-side dictionary currently based on the JMdict dataset.

View on GitHub Pages! https://moshikoi.github.io/Kotonoha/

# Features

 - Dictionary based on JMdict and Wiktionary
 - Sentence parser powered by UniDic
 - Example sentences from [massif.la](http://massif.la/ja)
    - Sentences ordered by vocabulary knowledge, so sentences with fewer unknown words are ranked higher 

# Todo

 - Better ordering of results
    - Multi-token consideration
       - For instance, currently you can only search for one token of おはよう|ござい|ます.
         This should be changed so you will instead search for any of おはよう|おはようござい|おはようございます, as well as their dictionary forms.
         The more tokens are matched, the higher the search score
    - Better token merging heuristics
 - More granualar vocabulary knowledge
 - Import/export of user data
 - Unidic pitch accents
 - Stablize the database generation tools

# Licence information

The licences for libraries used are copied into the `licences` folder, with file names corresponding with the library.

sql.js is used under the MIT licence

Parts of UniDic 2.1.2 in a compressed format are included in the `unidic` folder, and are used under the terms of the BSD Licence file in that folder.