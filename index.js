var BKD = require('bkd-tree')
var once = require('once')

module.exports = MBKD

function MBKD (opts) {
  if (!(this instanceof MBKD)) return new MBKD(opts)
  this.storage = opts.storage
  this._getId = opts.getId
  this._getPoint = opts.getPoint
  this.bkd = new BKD(this.storage, {
    type: opts.type,
    branchFactor: opts.branchFactor,
    levels: opts.levels,
    compare: opts.compare
  })
}

MBKD.prototype.batch = function (rows, cb) {
  var self = this
  cb = once(cb || noop)
  var ops = []
  var pending = 1
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i]
    var links = row.links || []
    ops.push({
      type: 'insert',
      point: row.point,
      value: [row.id]
    })
    links.forEach(function (link) {
      pending++
      self._getPoint(link, function (err, pt) {
        if (err) return cb(err)
        ops.push({
          type: 'delete',
          point: pt.point,
          value: pt.value
        })
        if (--pending === 0) done()
      })
    })
  }
  if (--pending === 0) done()

  function done () {
    self.bkd.batch(ops, cb)
  }
}

MBKD.prototype.query = function (bbox, cb) {
  this.bkd.query(bbox, cb)
}

function noop () {}
