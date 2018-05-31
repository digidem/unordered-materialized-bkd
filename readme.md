# unordered-materialized-bkd

materialized view spatial tree based on unordered log messages

This library finds points written to an append-only-log inside of a bounding box
search region. These points can update previous documents by linking to them
and the documents can be inserted into the log in any order. Every point that is
not linked to by any other point will be included in query results, including
multiple forks of the same underlying resource such as the values for a key.
This is sometimes known as a multi-register conflict strategy. Likewise,
multiple forks can be merged into a single value by linking to the forks.

This library is useful for kappa architectures with missing or out of order log
entries, or where calculating a topological ordering would be expensive.

This library does not store the primary records yourself to save space. You'll
need to pass in a function to perform lookups. You'll also need to pass in
another method to look up if a document has been linked to so that you can avoid
duplicating the work of other libraries such as [unordered-materialized-kv][].

[unordered-materialized-kv]: https://npmjs.com/package/unordered-materialized-kv

# example

This library stores a bkd tree in memory and prints all the "heads" (documents
that aren't linked to). In this case, there is one head: the document with id 3.

``` js
var memdb = require('memdb')
var ram = require('random-access-memory')
var concatMap = require('concat-map')
var umbkd = require('unordered-materialized-bkd')

var db = memdb({ valueEncoding: 'json' })
var bkd = umbkd({
  storage: function (name, cb) { cb(null, ram()) },
  isLinked: function (id, cb) {
    db.get('link!' + id, function (err, value) {
      cb(null, value !== undefined)
    })
  },
  getPoint: function (key, cb) {
    db.get('doc!' + key, function (err, doc) {
      if (err) cb(err)
      else cb(null, { point: doc.point, value: [doc.id] })
    })
  },
  type: {
    point: [ 'float64be', 'float64be' ],
    value: [ 'uint32be' ]
  },
  compare: function (a, b) {
    return a.value[0] === b.value[0]
  }
})

var docs = [
  { id: 0, links: [], point: [13.37,66.67] },
  { id: 1, links: [0], point: [-155.0,19.6] },
  { id: 2, links: [1], point: [-155.0,19.5] },
  { id: 3, links: [2], point: [-155.0,19.5] }
]

var dbBatch = concatMap(docs, function (doc) {
  return [
    {
      type: 'put',
      key: 'doc!' + doc.id,
      value: { id: doc.id, point: doc.point }
    }
  ].concat(doc.links.map(function (link) {
    return {
      type: 'put',
      key: 'link!' + link,
      value: ''
    }
  }))
})

db.batch(dbBatch, function (err) {
  if (err) return console.error(err)
  bkd.batch(docs, function (err) {
    if (err) return console.error(err)
    bkd.query([-180,-90,+180,+90], function (err, results) {
      if (err) return console.error(err)
      results.forEach(function (result) {
        console.log(result)
      })
    })
  })
})
```

output:

```
{ point: [ -155, 19.5 ], value: [ 3 ] }
```

If you use this module with [unordered-materialized-kv][], you can use the
`isLinked` implementation from that module:

``` js
var memdb = require('memdb')
var ram = require('random-access-memory')
var umkv = require('unordered-materialized-kv')
var umbkd = require('unordered-materialized-bkd')

var db = memdb({ valueEncoding: 'json' })
var kv = umkv(memdb())

var bkd = umbkd({
  storage: function (name, cb) { cb(null, ram()) },
  isLinked: function (id, cb) { kv.isLinked(id, cb) },
  getPoint: function (key, cb) {
    db.get(key, function (err, doc) {
      if (err) cb(err)
      else cb(null, { point: doc.point, value: [doc.id] })
    })
  },
  type: {
    point: [ 'float64be', 'float64be' ],
    value: [ 'uint32be' ]
  },
  compare: function (a, b) {
    return a.value[0] === b.value[0]
  }
})

var docs = [
  { key: 'x', id: 0, links: [], point: [13.37,66.67] },
  { key: 'x', id: 1, links: [0], point: [-155.0,19.6] },
  { key: 'x', id: 2, links: [1], point: [-155.0,19.5] },
  { key: 'x', id: 3, links: [2], point: [-155.0,19.5] }
]

var dbBatch = docs.map(function (doc) {
  return {
    type: 'put',
    key: doc.id,
    value: { id: doc.id, point: doc.point }
  }
})
var kvBatch = docs.map(function (doc) {
  return {
    key: doc.key,
    id: doc.id,
    links: doc.links
  }
})

db.batch(dbBatch, function (err) {
  if (err) return console.error(err)
  kv.batch(kvBatch, function (err) {
    if (err) return console.error(err)
    bkd.batch(docs, function (err) {
      if (err) return console.error(err)
      query()
    })
  })
})

function query () {
  bkd.query([-180,-90,+180,+90], function (err, results) {
    if (err) return console.error(err)
    results.forEach(function (result) {
      console.log(result)
    })
  })
}
```

# api

``` js
var umbkd = require('unordered-materialized-bkd')
```

## var bkd = umbkd(opts)

Create a new `bkd` instance from:

* `opts.storage` - [random-access][] `storage` instance
* `opts.getPoint(id, cb)` - provide the primary document for `id` as
  `cb(err, doc)`. The `doc` should have `doc.point` and `doc.value`.
* `opts.isLinked(id, cb)` - provide whether the document `id` is linked to by
  any other documents as `cb(err, exists)` for a boolean `exists`.

in addition to these options which are forwarded along to [bkd-tree][]:

* `opts.type.point` - array of types for the coordinates
* `opts.type.value` - array of types for the data payload
* `opts.branchFactor` - branch factor. default: 4
* `opts.levels` - number of levels in the smallest tree. default: 5
* `opts.compare(a,b)` - boolean comparison function required for deletes

[bkd-tree]: https://npmjs.com/package/bkd-tree
[random-access]: https://npmjs.com/package/abstract-random-access

## bkd.batch(rows, cb)

Write an array of `rows` into the `bkd`. Each `row` in the `rows` array has:

* `row.id` - unique identifier for each document
* `row.point` - spatial coordinate array
* `row.links` - array of document ids that this document supercedes

## bkd.query(bbox, cb)

Search for records as `cb(err, results)` in a bounding box `bbox`.

The `bbox` should contain all the minimum values for each dimension followed by
all the maximum values for each dimension. In 2d, the bbox is
`[minX,minY,maxX,maxY]`, or the more familiar `[west,south,east,north]`.

# install

```
npm install unordered-materialized-bkd
```

# license

BSD
