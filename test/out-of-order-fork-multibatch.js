var test = require('tape')
var memdb = require('memdb')
var ram = require('random-access-memory')
var umbkd = require('../')

test('out of order fork multibatch', function (t) {
  t.plan(11)
  var db = memdb({ valueEncoding: 'json' })
  var bkd = umbkd({
    storage: function (name, cb) { cb(null, ram()) },
    levels: 2,
    branchFactor: 4,
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
    { id: 2, links: [1], point: [-155.0,19.5] },
    { id: 3, links: [1], point: [-155.1,19.7] },
    // space out docs to nudge the earlier records out of staging
    { id: 1000, links: [], point: [-181,-91] },
    { id: 1001, links: [], point: [-181,-91] },
    { id: 1002, links: [], point: [-181,-91] },
    { id: 1003, links: [], point: [-181,-91] },
    { id: 1004, links: [], point: [-181,-91] },
    { id: 1005, links: [], point: [-181,-91] },
    { id: 1006, links: [], point: [-181,-91] },
    { id: 1007, links: [], point: [-181,-91] },
    { id: 1008, links: [], point: [-181,-91] },
    { id: 1009, links: [], point: [-181,-91] },
    { id: 1010, links: [], point: [-181,-91] },
    { id: 1011, links: [], point: [-181,-91] },
    { id: 1012, links: [], point: [-181,-91] },
    { id: 1013, links: [], point: [-181,-91] },
    { id: 1014, links: [], point: [-181,-91] },
    { id: 1015, links: [], point: [-181,-91] },

    { id: 1, links: [0], point: [-155.0,19.6] },
    { id: 0, links: [], point: [13.37,66.67] }
  ]
  db.batch(docs.map(function (doc) {
    return {
      type: 'put',
      key: doc.id,
      value: { id: doc.id, point: doc.point }
    }
  }), function (err) {
    t.error(err)
    ;(function next (i) {
      if (i === docs.length) return check()
      var batch = [docs[i]]
      bkd.batch(batch, function (err) {
        t.error(err)
        next(i+1)
      })
    })(0)
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
})
