import {nanoid} from "nanoid";

import {Queue} from "./queue"
import {StreamManager} from "../stream";
import {STATE} from "../types";

// beforeAll(() => {
// 	process.on('log', console.log)
// })

/**
 * Merge both methods together as it's the easiest way to test
 * */
describe('pub/sub', function () {

	let manager: StreamManager

	beforeEach(async () => {
		manager = new StreamManager('amqp://localhost')
		await manager.asPromise()
	})

	afterEach(async () => {
		await manager.quit()
	})

	it('should pass', function (done) {
		const name = createQueueName()
		const queue = new Queue(manager, name)
		queue.on('error', done)

		queue.publish('hello world')
		queue.subscribe<string>(makeCallback(done, context => {
			expect(context.packet).toEqual('hello world')
		}), { noAck: true })
	});

	it('should emit error when trying to publish closed', function (done) {
		const name = createQueueName()
		const queue = new Queue(manager, name)
		queue.on('error', makeCallback(done, error => {
			expect(error).toBeTruthy()
		}))

		// This is needed to fake a closing, could look into a proper closing method tho
		// @ts-ignore
		queue.$__state = STATE.CLOSED
		queue.publish('hello world')
	});

	it('should emit error when closed', function (done) {
		const name = createQueueName()
		const queue = new Queue(manager, name)
		queue.on('error', makeCallback(done, error => {
			expect(error).toBeTruthy()
		}))

		// This is needed to fake a closing, could look into a proper closing method tho
		// @ts-ignore
		queue.$__state = STATE.CLOSED
		queue.subscribe<void>(_ => {
			fail('Should not reach')
		})
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
