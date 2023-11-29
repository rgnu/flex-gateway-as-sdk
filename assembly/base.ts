import {
    RootContext,
    Context,
    LogLevelValues,
    WasmResultValues,
    Headers,
    HeaderPair,
    GrpcStatusValues,
    FilterHeadersStatusValues,
    stream_context,
    send_local_response,
} from "./runtime";

import {
    log,
    get_property,
    get_current_time_nanoseconds
    //@ts-ignore
} from "@solo-io/proxy-runtime/runtime"

import { parse } from '@serial-as/json'


class Environment {
    clusterId: string = ""
    connectionMode: string = ""
    flexVersion: string = ""
    rootOrganizationId: string = ""
    organizationId: string = ""
    environmentId: string = ""
}

//@ts-ignore
@serializable
class Logging {
    level: string = "info"
}

//@ts-ignore
@serializable
class PolicyConfig {
    logging: Logging = new Logging()
}

//@ts-ignore
@serializable
class ApiContext {
    environment: Environment = new Environment()
    policyConfig: PolicyConfig = new PolicyConfig()
}

export class BaseRootContext extends RootContext {
    apiContext: ApiContext = new ApiContext()
    apiName: string = ""
    policyName: string = ""
    logLevel: LogLevelValues = LogLevelValues.info

    getContextId(): u32 {
        return this.context_id;
    }

    getApiName(): string {
        return this.apiName;
    }

    getApicontext(): ApiContext {
        return this.apiContext;
    }

    getPolicyName(): String {
        return this.policyName;
    }

    getLogLevel(): LogLevelValues {
        if (this.apiContext.policyConfig.logging.level == "debug")
            return LogLevelValues.debug
        else if (this.apiContext.policyConfig.logging.level == "warning")
            return LogLevelValues.warn
        else if (this.apiContext.policyConfig.logging.level == "error")
            return LogLevelValues.error
        return LogLevelValues.info
    }

    log(level: LogLevelValues, msg: string): void {
        if (level >= this.logLevel) {
            log(level, `[policy: ${this.policyName}][api: ${this.apiName}]${msg}`);
        }
    }

    logDebug(msg: string): void {
        this.log(LogLevelValues.debug, msg);
    }

    logInfo(msg: string): void {
        this.log(LogLevelValues.info, msg);
    }

    logWarn(msg: string): void {
        this.log(LogLevelValues.warn, msg);
    }

    logError(msg: string): void {
        this.log(LogLevelValues.error, msg);
    }

    getCurrentTimeNano(): u64 {
        return get_current_time_nanoseconds();
    }

    getProperty(path: string[]): ArrayBuffer {
        return get_property(path.join("\0"));
    }

    getDataViewProperty(path: string[]): DataView {
        return new DataView(this.getProperty(path), 0);
    }

    getInt64Property(path: string[]): i64 {
        return this.getDataViewProperty(path).getInt64(0, true);
    }

    getUInt64Property(path: string[]): u64 {
        return this.getDataViewProperty(path).getUint64(0, true);
    }

    getInt32Property(path: string[]): i32 {
        return this.getDataViewProperty(path).getInt32(0, true);
    }

    getUInt32Property(path: string[]): u32 {
        return this.getDataViewProperty(path).getUint32(0, true);
    }

    getStringProperty(path: string[]): string {
        return String.UTF8.decode(this.getProperty(path));
    }

    getDateProperty(path: string[]): Date {
        return new Date(this.getInt64Property(path));
    }

    sendHttpResponse(status: u32, statusDetail: string, body: ArrayBuffer, headers: Headers): WasmResultValues {
        return send_local_response(status, statusDetail, body, headers, GrpcStatusValues.Unknown);
    }

    onStart(size: usize): bool {
        const name = this.getStringProperty(["plugin_name"]).split(".");
        this.apiName = name.slice(2).join(".");
        this.policyName = name.slice(0, 2).join(".");

        const ctx = this.getStringProperty(["listener_metadata", "filter_metadata", this.apiName, "context"]);
        if (ctx != "") {
            this.apiContext = parse<ApiContext>(ctx)
        }

        this.logLevel = this.getLogLevel()

        return true;
    }
}

export class BaseContext<T extends BaseRootContext> extends Context {
    root_context: T;
    request_id: string = ""

    constructor(context_id: u32, root_context: T) {
        super(context_id, root_context);
        this.root_context = root_context;
    }

    getRootContext(): T {
        return this.root_context;
    }

    getContextId(): u32 {
        return this.context_id;
    }

    getRequestId(): String {
        return this.request_id
    }

    log(level: LogLevelValues, message: string): void {
        this.root_context.log(level, `[req: ${this.request_id}]${message}`);
    }

    logDebug(msg: string): void {
        this.log(LogLevelValues.debug, msg);
    }

    logInfo(msg: string): void {
        this.log(LogLevelValues.info, msg);
    }

    logWarn(msg: string): void {
        this.log(LogLevelValues.warn, msg);
    }

    logError(msg: string): void {
        this.log(LogLevelValues.error, msg);
    }

    getRequestHeaders(): Headers {
        return stream_context.headers.request.get_headers()
    }

    getRequestHeader(name: string): string {
        return stream_context.headers.request.get(name);
    }

    addRequestHeader(name: string, value: string): void {
        stream_context.headers.request.add(name, value);
    }

    getResponseHeaders(): Headers {
        return stream_context.headers.response.get_headers()
    }

    getResponseHeader(name: string): string {
        return stream_context.headers.response.get(name);
    }

    addResponseHeader(name: string, value: string): void {
        stream_context.headers.response.add(name, value);
    }

    getHttpCallbackHeaders(): Headers {
        return stream_context.headers.http_callback.get_headers();
    }

    getHttpCallbackHeader(name: string): string {
        return stream_context.headers.http_callback.get(name);
    }

    createHeader(key: string, value: string): HeaderPair {
        return new HeaderPair(String.UTF8.encode(key), String.UTF8.encode(value));
    }

    onRequestHeaders(a: u32, end: bool): FilterHeadersStatusValues {
        this.request_id = this.getRootContext().getStringProperty(["request", "id"]);

        return FilterHeadersStatusValues.Continue;
    }

}
