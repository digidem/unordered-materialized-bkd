var memdb = require('memdb')
var ram = require('random-access-memory')
var umkv = require('unordered-materialized-kv')
var umbkd = require('../')

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
