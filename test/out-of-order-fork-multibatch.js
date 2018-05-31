var test = require('tape')
var memdb = require('memdb')
var ram = require('random-access-memory')
var concatMap = require('concat-map')
var umbkd = require('../')

test('out of order fork multibatch', function (t) {
  t.plan(27)
  var db = memdb({ valueEncoding: 'json' })
  var bkd = umbkd({
    storage: function (name, cb) { cb(null, ram()) },
    levels: 2,
    branchFactor: 4,
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
    { id: 2, key: 'a', links: [1], point: [-155.0,19.5] },
    { id: 3, key: 'a', links: [1], point: [-155.1,19.7] },
    // space out docs to nudge the earlier records out of staging
    { id: 1000, key: 'b', links: [], point: [-181,-91] },
    { id: 1001, key: 'b', links: [], point: [-181,-91] },
    { id: 1002, key: 'b', links: [], point: [-181,-91] },
    { id: 1003, key: 'b', links: [], point: [-181,-91] },
    { id: 1004, key: 'b', links: [], point: [-181,-91] },
    { id: 1005, key: 'b', links: [], point: [-181,-91] },
    { id: 1006, key: 'b', links: [], point: [-181,-91] },
    { id: 1007, key: 'b', links: [], point: [-181,-91] },
    { id: 1008, key: 'b', links: [], point: [-181,-91] },
    { id: 1009, key: 'b', links: [], point: [-181,-91] },
    { id: 1010, key: 'b', links: [], point: [-181,-91] },
    { id: 1011, key: 'b', links: [], point: [-181,-91] },
    { id: 1012, key: 'b', links: [], point: [-181,-91] },
    { id: 1013, key: 'b', links: [], point: [-181,-91] },
    { id: 1014, key: 'b', links: [], point: [-181,-91] },
    { id: 1015, key: 'b', links: [], point: [-181,-91] },
    // ---
    { id: 1, key: 'a', links: [0], point: [-155.0,19.6] },
    { id: 0, key: 'a', links: [], point: [13.37,66.67] }
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
    ;(function next (i) {
      if (i === docs.length) return check()
      var batch = [docs[i]]
      bkd.batch(batch, function (err) {
        t.error(err)
        next(i+1)
      })
    })(0)
  }
  function check () {
    bkd.query([10,60,20,70], function (err, results) {
      t.error(err)
      t.deepEqual(results, [])
    })
    bkd.query([-156,19,-154,20], function (err, results) {
      t.error(err)
      t.deepEqual(results, [
        { point: [-155.0,19.5], value: [2] },
        { point: [-155.1,19.7], value: [3] }
      ])
    })
    bkd.query([-180,-90,+180,+90], function (err, results) {
      t.error(err)
      t.deepEqual(results, [
        { point: [-155.0,19.5], value: [2] },
        { point: [-155.1,19.7], value: [3] }
      ])
    })
  }
})
