/* eslint-env mocha */
const should = require('should')
const sinon = require('sinon')

const Device = require('../lib/device')

describe('Device', function() {
  let device = null

  beforeEach(function() {
    device = new Device('SHSW-1', 'ABC123', '192.168.1.2')
  })

  afterEach(function() {
    device = null
  })

  describe('.deviceTypeToClass()', function() {
    it('should return classes for known device types', function() {
      Device.deviceTypeToClass('SHSW-1').should.be.Function()
      Device.deviceTypeToClass('SHSW-21').should.be.Function()
    })

    it('should return undefined for unknown device types', function() {
      should(Device.deviceTypeToClass('UNKNOWN-1')).be.undefined()
    })
  })

  describe('.create()', function() {
    it('should return instances of Device for known device types', function() {
      Device.create(
        'SHSW-1',
        'ABC123',
        '192.168.1.2'
      ).should.be.instanceof(Device)
    })

    it('should return null for unknown device types', function() {
      should(Device.create(
        'UNKNOWN-1',
        'ABC123',
        '192.168.1.2'
      )).be.null()
    })
  })

  describe('#online', function() {
    it('should be true by default', function() {
      device.online.should.equal(true)
    })

    it('should emit `online` and `offline` events upon changes', function() {
      const onlineHandler = sinon.fake()
      const offlineHandler = sinon.fake()
      device.on('online', onlineHandler).on('offline', offlineHandler)

      device.online = false
      onlineHandler.called.should.equal(false)
      offlineHandler.calledOnce.should.equal(true)
      offlineHandler.calledWith(device).should.equal(true)

      device.online = false
      onlineHandler.called.should.equal(false)
      offlineHandler.calledOnce.should.equal(true)

      device.online = true
      onlineHandler.calledOnce.should.equal(true)
      onlineHandler.calledWith(device).should.equal(true)
      offlineHandler.calledOnce.should.equal(true)

      device.online = true
      onlineHandler.calledOnce.should.equal(true)
      offlineHandler.calledOnce.should.equal(true)
    })
  })

  describe('#ttl', function() {
    it('should set `online` to false after the given time', function() {
      const clock = sinon.useFakeTimers()

      device.ttl = 1000
      clock.tick(500)
      device.online.should.equal(true)
      clock.tick(500)
      device.online.should.equal(false)

      clock.restore()
    })

    it('should not set `online` to false when set to 0', function() {
      const clock = sinon.useFakeTimers()

      device.online.should.equal(true)
      device.ttl = 1000
      device.ttl = 0
      device.online.should.equal(true)
      clock.tick(1000)
      device.online.should.equal(true)

      clock.restore()
    })
  })

  describe('#_defineProperty()', function() {
    it('should define a property', function() {
      device._defineProperty('foo')
      device.hasOwnProperty('foo').should.equal(true)
      should(device.foo).be.null()
      device.foo = 'bar'
      device.foo.should.equal('bar')
    })

    it('should associate the property with the given ID', function() {
      device._defineProperty('foo', 1)
      device._props.get(1).should.equal('foo')
    })

    it('should not associate the property when no ID is given', function() {
      device._defineProperty('foo', null)
      device._props.has(null).should.equal(false)
    })

    it('should properly set the default value', function() {
      device._defineProperty('foo', null, 'bar')
      device.foo.should.equal('bar')
    })

    it('should invoke the validator when setting a value', function() {
      const validator = val => val.toUpperCase()
      device._defineProperty('foo', null, null, validator)
      device.foo = 'bar'
      device.foo.should.equal('BAR')
    })

    it('should emit `change` events when the property changes', function() {
      const changeHandler = sinon.fake()
      const changeFooHandler = sinon.fake()
      device.on('change', changeHandler).on('change:foo', changeFooHandler)

      device._defineProperty('foo')
      device.foo = 'bar'

      changeHandler.calledOnce.should.equal(true)
      changeHandler.calledWith('foo', 'bar', null, device).should.equal(true)
      changeFooHandler.calledOnce.should.equal(true)
      changeFooHandler.calledWith('bar', null, device).should.equal(true)
    })
  })

  describe('#[Symbol.iterator]()', function() {
    it('should return an iterator', function() {
      device.should.be.iterable()
      device[Symbol.iterator]().should.be.iterator()
    })

    it('should iterate through properties with IDs', function() {
      device._defineProperty('foo', 1)
      device._defineProperty('bar')
      device._defineProperty('baz', 2)

      const seenProps = new Set()

      for (let [key, value] of device) { // eslint-disable-line no-unused-vars
        seenProps.add(key)
      }

      seenProps.has('foo').should.equal(true)
      seenProps.has('baz').should.equal(true)
    })
  })

  describe('#update()', function() {
    it('should set `online` to true', function() {
      device.online = false
      device.update({})
      device.online.should.equal(true)
    })

    it('should not set `ttl` when `validFor` is not specified', function() {
      device.ttl = 0
      device.update({})
      device.ttl.should.equal(0)
    })

    it('should set `ttl` when `validFor` is specified', function() {
      const msg = {
        validFor: 37,
      }

      device.ttl = 0
      device.update(msg)
      device.ttl.should.equal(msg.validFor * 1000)
    })

    it('should invoke _applyUpdate() when a new serial is given', function() {
      const _applyUpdate = sinon.stub(device, '_applyUpdate')
      const msg = {
        serial: 123,
      }

      device.update(msg)
      _applyUpdate.calledOnce.should.equal(true)

      device.update(msg)
      _applyUpdate.calledOnce.should.equal(true)

      device.update({ serial: msg.serial + 1 })
      _applyUpdate.calledTwice.should.equal(true)
    })
  })

  describe('#_applyUpdate()', function() {
    it('should update the host', function() {
      const changeHostHandler = sinon.fake()
      const msg = {
        host: '192.168.1.3',
      }

      device.on('change:host', changeHostHandler)
      device._applyUpdate(msg, [])

      changeHostHandler.calledOnce.should.equal(true)
      changeHostHandler.calledWith(msg.host).should.equal(true)
    })

    it('should update the properties from to the payload', function() {
      const changeFooHandler = sinon.fake()
      const payload = [
        [ 0, 1, 2 ],
      ]

      device._defineProperty('foo', 1)
      device.on('change:foo', changeFooHandler)
      device._applyUpdate({}, payload)

      changeFooHandler.calledOnce.should.equal(true)
      changeFooHandler.calledWith(payload[0][2]).should.equal(true)
    })
  })
})
