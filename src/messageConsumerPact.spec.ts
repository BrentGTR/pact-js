/* tslint:disable:no-unused-expression no-empty */
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import {
  MessageConsumerPact,
  synchronousBodyHandler,
  asynchronousBodyHandler,
} from './messageConsumerPact';
import { ConcreteMessage } from './dsl/message';

chai.use(sinonChai);
chai.use(chaiAsPromised);

const { expect } = chai;

describe('MessageConsumer', () => {
  let consumer: MessageConsumerPact;

  beforeEach(() => {
    consumer = new MessageConsumerPact({
      consumer: 'myconsumer',
      provider: 'myprovider',
    });
  });

  const testMessage: ConcreteMessage = {
    contents: {
      foo: 'bar',
    },
  };

  describe('#constructor', () => {
    it('creates a Consumer when all mandatory parameters are provided', () => {
      expect(consumer).to.be.a('object');
      expect(consumer).to.respondTo('verify');
    });
  });

  describe('#dsl', () => {
    describe('when a valid state has been given', () => {
      it('the state should be save id in v3 format', () => {
        consumer
          .given('some state')
          .expectsToReceive('A message about something')
          .withContent({ foo: 'bar' })
          .withMetadata({ baz: 'bat' });

        expect(consumer.json().providerStates).to.be.a('array');
        expect(consumer.json().providerStates).to.deep.eq([
          { name: 'some state' },
        ]);
      });
    });
    describe('when an empty description has been given', () => {
      it('it should throw an error', () => {
        expect(() => {
          consumer.expectsToReceive('');
        }).to.throw(Error);
      });
    });
    describe('when an empty content object has been given', () => {
      it('it should throw an error', () => {
        expect(() => {
          consumer.withContent({});
        }).to.throw(Error);
      });
    });
    describe('when an empty metadata object has been given', () => {
      it('it should throw an error', () => {
        expect(() => {
          consumer.withMetadata({});
        }).to.throw(Error);
      });
    });
  });

  describe('#verify', () => {
    describe('when given a valid handler and message', () => {
      it('verifies the consumer message', () => {
        const stubbedConsumer = new MessageConsumerPact({
          consumer: 'myconsumer',
          provider: 'myprovider',
        });
        const stub = stubbedConsumer as any;

        // Stub out service factory
        stub.getServiceFactory = () => ({
          createMessage: () => Promise.resolve('message created'),
        });

        stubbedConsumer
          .given('some state')
          .expectsToReceive('A message about something')
          .withContent({ foo: 'bar' })
          .withMetadata({ baz: 'bat' });

        return expect(stubbedConsumer.verify(() => Promise.resolve('yay!'))).to
          .eventually.be.fulfilled;
      });
    });
  });

  describe('#json', () => {
    it('returns a valid Message object', () => {
      consumer.withContent({ foo: 'bar' });
      const m = consumer.json();

      expect(m.contents).to.deep.eq({ foo: 'bar' });
    });
  });

  describe('#getServiceFactory', () => {
    it('returns a valid pact-core object', () => {
      const serviceFactory = (consumer as any).getServiceFactory();
      expect(serviceFactory).to.be.a('object');
      expect(serviceFactory).to.respondTo('createMessage');
    });
  });

  describe('handler transformers', () => {
    describe('#asynchronousbodyHandler', () => {
      describe('when given a function that succeeds', () => {
        it('returns a Handler object that returns a completed promise', () => {
          const failFn = () => Promise.resolve('yay!');
          const hFn = asynchronousBodyHandler(failFn);

          return expect(hFn(testMessage)).to.eventually.be.fulfilled;
        });
      });
      describe('when given a function that throws an Exception', () => {
        it('returns a Handler object that returns a rejected promise', () => {
          const failFn = () => Promise.reject(new Error('fail'));
          const hFn = asynchronousBodyHandler(failFn);

          return expect(hFn(testMessage)).to.eventually.be.rejected;
        });
      });
    });

    describe('#synchronousbodyHandler', () => {
      describe('when given a function that succeeds', () => {
        it('returns a Handler object that returns a completed promise', () => {
          const failFn = () => {
            /* do nothing! */
          };
          const hFn = synchronousBodyHandler(failFn);

          return expect(hFn(testMessage)).to.eventually.be.fulfilled;
        });
      });

      describe('when given a function that throws an Exception', () => {
        it('returns a Handler object that returns a rejected promise', () => {
          const failFn = () => {
            throw new Error('fail');
          };
          const hFn = synchronousBodyHandler(failFn);

          return expect(hFn(testMessage)).to.eventually.be.rejected;
        });
      });
    });
  });
});
