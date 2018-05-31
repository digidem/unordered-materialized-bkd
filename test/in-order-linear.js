var test = require('tape')
var memdb = require('memdb')
var ram = require('random-access-memory')
var concatMap = require('concat-map')
var umbkd = require('../')

test('in-order linear sequence', function (t) {
  t.plan(8)
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
    { id: 2, links: [1], point: [-155.0,19.5] }
  ]
  db.batch(concatMap(docs, function (doc) {
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
  }), onbatch)

  function onbatch (err) {
    t.error(err)
    bkd.batch(docs, function (err) {
      t.error(err)
      bkd.query([10,60,20,70], function (err, results) {
        t.error(err)
        t.deepEqual(results, [])
      })
      bkd.query([-156,19,-154,20], function (err, results) {
        t.error(err)
        t.deepEqual(results, [ { point: [-155.0,19.5], value: [2] } ])
      })
      bkd.query([-180,-90,+180,+90], function (err, results) {
        t.error(err)
        t.deepEqual(results, [ { point: [-155.0,19.5], value: [2] } ])
      })
    })
  }
})
