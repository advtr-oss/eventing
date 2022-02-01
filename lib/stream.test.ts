import { StreamManager } from "./stream";
import {nanoid} from "nanoid";
import {BaseQueue} from "./base-queue";

describe('StreamManager()', function () {
	let manager: StreamManager

	afterEach(async function () {
		await manager.quit()
	})

	it('should create a manager', function (done) {
		manager = new StreamManager('amqp://localhost')
		manager.on('open', makeCallback(done, m => {
			expect(m).toStrictEqual(manager)
		}))
	});

	it('should create a manager with callback', function (done) {
		manager = new StreamManager('amqp://localhost', makeCallback(done, (error, m) => {
			expect(error).toBeNull()
			expect(m).toStrictEqual(manager)
		}))
	});

	it('should create a valid promise', async function () {
		manager = await (new StreamManager('amqp://localhost')).asPromise()
		expect(manager).toBeTruthy()
	});

	it('should return error on invalid connection uri', function (done) {
		manager = new StreamManager('amqp://invalid-uri', makeCallback(done, (error, m) => {
			expect(error).not.toBeNull()
			expect(m).not.toBeTruthy()
		}))
	});

	it('should throw the invalid uri', async function () {
		manager = new StreamManager('amqp://invalid-uri')
		try {
			await manager.asPromise()
			fail('Should not be reached')
		} catch (err) {
			expect(err).not.toBeNull()
		}
	});
});

describe('create()', function () {
	let manager: StreamManager

	afterEach(async function () {
		await manager.quit()
	})

	it('should create new queue', async function () {
		manager = new StreamManager('amqp://localhost')

		const name = createQueueName()
		const queue = await manager.create(name).asPromise()

		expect(queue.name).toEqual(name)
	});
});

describe('register()', function () {
	let manager: StreamManager

	afterEach(async function () {
		await manager.quit()
	})

	it('should register valid queue', async function () {
		manager = new StreamManager('amqp://localhost')

		const name = createQueueName()
		const queue = new BaseQueue(manager, name)
		await queue.asPromise()

		expect(queue.name).toEqual(name)
		expect(() => manager.register(queue)).not.toThrow()
	});

	it('should throw when registering a registered queue', async function () {
		manager = new StreamManager('amqp://localhost')

		const name = createQueueName()
		const queue = await manager.create(name).asPromise()

		expect(queue.name).toEqual(name)
		expect(() => manager.register(queue)).toThrow()
	});
});

function makeCallback(done, body) {
	return (...args) => {
		try {
			body(...args);
			done();
		} catch (error) {
			done(error);
		}
	};
}

function createQueueName (name?: String) {
	if (!name) return nanoid()
	return name!.replace('', '_')
}
