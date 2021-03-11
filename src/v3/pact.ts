import { omit, join, toPairs, map, flatten } from "ramda"
import * as MatchersV3 from "./matchers"
import { version as pactPackageVersion } from "../../package.json"

const PactNative = require("../../native/index.node")

/**
 * Options for the mock server
 */
export interface PactV3Options {
  /**
   * Directory to write the pact file to
   */
  dir: string
  /**
   * Consumer name
   */
  consumer: string
  /**
   * Provider name
   */
  provider: string
  /**
   * If the mock server should handle CORS pre-flight requests. Defaults to false
   */
  cors?: boolean
  /**
   * Port to run the mock server on. Defaults to a random port
   */
  port?: number
}

export interface V3ProviderState {
  description: string
  parameters?: any
}

export interface V3Request {
  method?: string
  path?: string | MatchersV3.Matcher
  query?: {
    [param: string]: string | MatchersV3.Matcher
  }
  headers?: {
    [header: string]: string | MatchersV3.Matcher
  }
  body?: any
}

export interface V3Response {
  status: number
  headers?: {
    [header: string]: string | MatchersV3.Matcher
  }
  body?: any
}

export interface V3MockServer {
  port: number
  url: string
  id: string
}

export interface Mismatch {
  path?: string
  method?: string
  type: string
  request?: V3Request
}

function displayQuery(query: { [k: string]: string[] }): string {
  const pairs = toPairs(query)
  const mapped = flatten(
    map(([key, values]) => map((val) => `${key}=${val}`, values), pairs)
  )
  return join("&", mapped)
}

function displayHeaders(headers: any, indent: string): string {
  return join(
    "\n" + indent,
    map(([k, v]) => `${k}: ${v}`, toPairs(headers))
  )
}

function displayRequest(request: any, indent: string): string {
  let output = `\n${indent}Method: ${request.method}\n${indent}Path: ${request.path}`

  if (request.query) {
    output += `\n${indent}Query String: ${displayQuery(request.query)}`
  }

  if (request.headers) {
    output += `\n${indent}Headers:\n${indent}  ${displayHeaders(
      request.headers,
      indent + "  "
    )}`
  }

  if (request.body) {
    output += `\n${indent}Body: ${request.body.substr(0, 20)}... (${
      request.body.length
    } length)`
  }

  return output
}

function filterMissingFeatureFlag(mismatches: Mismatch[]) {
  if (process.env.PACT_EXPERIMENTAL_FEATURE_ALLOW_MISSING_REQUESTS) {
    return mismatches.filter((m) => m.type !== "missing-request")
  } else {
    return mismatches
  }
}

function extractMismatches(mockServerMismatches: any[]): Mismatch[] {
  return mockServerMismatches.map((mismatchJson) => JSON.parse(mismatchJson))
}

function generateMockServerError(mismatches: Mismatch[], indent: string) {
  let error = "Mock server failed with the following mismatches: "

  let i = 1
  for (const mismatch of mismatches) {
    if (mismatch.type === "request-not-found") {
      error += `\n\n${indent}${i++}) The following request was not expected: ${displayRequest(
        mismatch.request,
        indent + "    "
      )}`
    } else if (mismatch.type === "missing-request") {
      error += `\n\n${indent}${i++}) The following request was expected but not received: ${displayRequest(
        mismatch.request,
        indent + "    "
      )}`
    } else {
      error += `\n${indent}${i++}) ${mismatch.type} ${
        mismatch.path ? `(at ${mismatch.path}) ` : ""
      }${mismatch}`
    }
  }

  return error
}

export class PactV3 {
  private opts: PactV3Options & {}
  private states: V3ProviderState[] = []
  private pact: any

  constructor(opts: PactV3Options & {}) {
    this.opts = opts
    this.pact = new PactNative.Pact(
      opts.consumer,
      opts.provider,
      pactPackageVersion,
      omit(["consumer", "provider", "dir"], opts)
    )
  }

  public given(providerState: string, parameters?: any): PactV3 {
    this.states.push({ description: providerState, parameters })
    return this
  }

  public uponReceiving(desc: string): PactV3 {
    this.pact.addInteraction(desc, this.states)
    return this
  }

  public withRequest(req: V3Request): PactV3 {
    let body = req.body
    if (typeof body !== "string") {
      body = body && JSON.stringify(body)
    }
    this.pact.addRequest(req, body)
    return this
  }

  public withRequestBinaryFile(
    req: V3Request,
    contentType: string,
    file: string
  ): PactV3 {
    this.pact.addRequestBinaryFile(req, contentType, file)
    return this
  }

  public withRequestMultipartFileUpload(
    req: V3Request,
    contentType: string,
    file: string,
    part: string
  ): PactV3 {
    this.pact.addRequestMultipartFileUpload(req, contentType, file, part)
    return this
  }

  public willRespondWith(res: V3Response): PactV3 {
    let body = res.body
    if (typeof body !== "string") {
      body = body && JSON.stringify(body)
    }
    this.pact.addResponse(res, body)
    this.states = []
    return this
  }

  public withResponseBinaryFile(
    res: V3Response,
    contentType: string,
    file: string
  ): PactV3 {
    this.pact.addResponseBinaryFile(res, contentType, file)
    return this
  }

  public withResponseMultipartFileUpload(
    req: V3Response,
    contentType: string,
    file: string,
    part: string
  ): PactV3 {
    this.pact.addResponseMultipartFileUpload(req, contentType, file, part)
    return this
  }

  public executeTest<T>(
    testFn: (mockServer: V3MockServer) => Promise<T>
  ): Promise<T> {
    const result = this.pact.executeTest(testFn, this.opts)
    if (result.testResult) {
      return result.testResult
        .then((val: T) => {
          const testResult = this.pact.getTestResult(result.mockServer.id)
          if (testResult.mockServerError) {
            return Promise.reject(new Error(testResult.mockServerError))
          } else if (testResult.mockServerMismatches) {
            const mismatches = extractMismatches(
              testResult.mockServerMismatches
            )
            if (filterMissingFeatureFlag(mismatches).length > 0) {
              // Feature flag: allow missing requests on the mock service
              return Promise.reject(
                new Error(generateMockServerError(mismatches, "  "))
              )
            }
          }

          this.pact.writePactFile(result.mockServer.id, this.opts)
          return val
        })
        .catch((err: Error) => {
          const testResult = this.pact.getTestResult(result.mockServer.id)
          if (testResult.mockServerError || testResult.mockServerMismatches) {
            let error = "Test failed for the following reasons:"
            error += "\n\n  Test code failed with an error: " + err.message
            if (err.stack) {
              error += "\n" + err.stack + "\n"
            }

            if (testResult.mockServerError) {
              error += "\n\n  " + testResult.mockServerError
            }
            if (testResult.mockServerMismatches) {
              error += "\n\n  " + generateMockServerError(testResult, "    ")
            }
            return Promise.reject(new Error(error))
          } else {
            return Promise.reject(err)
          }
        })
        .finally(() => {
          this.pact.shutdownTest(result)
        })
    } else {
      this.pact.shutdownTest(result)
      return Promise.reject(result.testError)
    }
  }
}
