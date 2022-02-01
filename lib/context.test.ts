import { createContext, Context } from './context'
import { BaseQueue } from "./base-queue";
import { StreamManager } from "./stream";
import { ExecuteWhenOpen } from "./symbols"

let manager: StreamManager
beforeAll(function () {
	manager = new StreamManager('amqp://localhost')
})

afterAll(async function () {
	await manager.quit()
})

describe('createContext', function () {

	let context: Context;

	beforeAll(async () => {
		const queue = new BaseQueue(manager, 'createContextQueue', { })
		await queue[ExecuteWhenOpen]()

		context = createContext<{ 'Hello': string }>({
			queue: queue,
			message: {
				fields: {
					consumerTag: '',
					deliveryTag: 1,
					redelivered: false,
					exchange: '',
					routingKey: ''
				},
				content: Buffer.from(JSON.stringify({ 'Hello': 'World' })),
				properties: {
					headers: { }
				}
			}
		})
	})

	/**
	 * These will throw but that's the correct pattern
	 * */
	it('should publish', function () {
		const ctx = context

		expect(ctx.packet.Hello).toEqual('World')
		// This will throw on purpose due to using BaseQueue
		expect(() => ctx.publish('Hello World')).toThrow()
	});

	/**
	 * These will throw but that's the correct pattern
	 * */
	it('should ack', function () {
		const ctx = context

		expect(ctx.packet.Hello).toEqual('World')
		// This will throw on purpose due to not working w/ a real message
		expect(() => ctx.ack()).toThrow()
	});
});
