import { BaseQueue } from "./base-queue";
import {StreamManager} from "./stream";
import {ExecuteWhenOpen, Abort} from "./symbols"
import { nanoid } from "nanoid";

// beforeAll(() => {
// 	process.on('log', console.log)
// })

describe('BaseQueue()', function () {
	describe('working with valid manager', function () {
		let manager: StreamManager

		beforeEach(async () => {
			manager = new StreamManager('amqp://localhost')
			await manager.asPromise()
		})

		afterEach(async () => {
			await manager.quit()
		})

		it('should create a queue with just a name', async function () {
			const name = createQueueName()
			const queue = new BaseQueue(manager, name)
			// queue.on('error:opening', console.log)

			await queue.asPromise()

			expect(queue).toBeTruthy()
			expect(queue.name).toEqual(name)
		});

		it('should create a queue with options', async function () {
			const name = createQueueName()
			const queue = new BaseQueue(manager, name, { durable: true })
			// queue.on('error:opening', console.log)

			await queue.asPromise()

			expect(queue).toBeTruthy()
			expect(queue.name).toEqual(name)
			expect(queue.options.durable).toBeTruthy()
		});

		it('should create a queue with a callback', async function () {
			const fn = jest.fn()
			const name = createQueueName()
			const queue = new BaseQueue(manager, name, fn)
			// queue.on('error:opening', console.log)

			await queue.asPromise()

			expect(queue).toBeTruthy()
			expect(queue.name).toEqual(name)
			expect(fn).toBeCalledTimes(1)
		});

		it('should create a queue with a callback and options', async function () {
			const fn = jest.fn()
			const name = createQueueName()
			const queue = new BaseQueue(manager, name, { durable: true }, fn)
			// queue.on('error:opening', console.log)

			await queue.asPromise()

			expect(queue).toBeTruthy()
			expect(queue.name).toEqual(name)
			expect(queue.options.durable).toBeTruthy()
			expect(fn).toBeCalledTimes(1)
		});

		it('should throw for invalid queue', async function () {
			const name = createQueueName()
			const durable = new BaseQueue(manager, name, { durable: true })

			try {
				await durable.asPromise()

				const volatile = new BaseQueue(manager, name, { durable: false })
				await volatile.asPromise()

				fail('Should not be reached')
			} catch (err) {
				expect(err).toBeTruthy()
			}
		});
	});

	describe('working with invalid manager', function () {
		let manager: StreamManager

		afterEach(async () => {
			manager && await manager.quit()
		})

		/**
		 * For not using promises the bellow can't be tested here, it would require the
		 * queue to be made via the manager, as that controls the aborting on errors
		 * */
		it('should throw on an already closed connection', async function () {
			manager = new StreamManager('amqp://invalid-uri')
			try {
				await manager.asPromise()
				fail('Should not be reached')
			} catch (_) { }

			const name = createQueueName()
			const queue = new BaseQueue(manager, name)

			try {
				await queue.asPromise()
				fail('Should not be reached')
			} catch (err) {
				expect(err).toBeTruthy()
			}
		});

		it('should abort when called', function (done) {
			manager = new StreamManager('amqp://localhost', (error, m) => {
				const name = createQueueName()
				const queue = new BaseQueue(m!, name, makeCallback(done, error => {
					expect(error).toBeTruthy()
				}))

				// This has to be this fast
				setTimeout(() => {
					queue[Abort]()
				}, 2)
			})
		});
	});
});

describe('prefetch()', function () {
	let manager: StreamManager

	beforeEach(async () => {
		manager = new StreamManager('amqp://localhost')
		await manager.asPromise()
	})

	afterEach(async () => {
		await manager.quit()
	})

	it('should handle any errors', async function () {
		const name = createQueueName()
		const queue = new BaseQueue(manager, name)
		// This is for the error that would be thrown
		queue.on('error', (error) => expect(error).not.toBeTruthy())
		queue.prefetch(1)

		// @ts-ignore
		expect(queue.$__buffer).toHaveLength(1)

		await queue.asPromise()
	});
});

describe('publish()', function () {
	let manager: StreamManager

	beforeEach(async () => {
		manager = new StreamManager('amqp://localhost')
		await manager.asPromise()
	})

	afterEach(async () => {
		await manager.quit()
	})

	it('should throw an error', async function () {
		const name = createQueueName()
		const queue = new BaseQueue(manager, name)

		await queue.asPromise()

		expect(() => queue.publish()).toThrow()
	});
});

describe('subscribe()', function () {
	let manager: StreamManager

	beforeEach(async () => {
		manager = new StreamManager('amqp://localhost')
		await manager.asPromise()
	})

	afterEach(async () => {
		await manager.quit()
	})

	it('should throw an error', async function () {
		const fn = jest.fn()

		const name = createQueueName()
		const queue = new BaseQueue(manager, name)

		await queue.asPromise()

		expect(() => queue.subscribe(fn)).toThrow()
		expect(fn).not.toBeCalled()
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
