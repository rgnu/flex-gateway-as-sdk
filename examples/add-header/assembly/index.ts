//@ts-ignore
export * from "@rgnu/flex-gateway-as-sdk/proxy"; // this exports the required functions for the proxy to interact with us.

import { Context, FilterHeadersStatusValues, FlexContext, FlexRootContext, registerRootContext } from "@rgnu/flex-gateway-as-sdk";

class Config {
  greeting: string = "Hello!"
}

class AddHeaderRoot extends FlexRootContext<Config> {
  createContext(context_id: u32): Context {
    return new AddHeader(context_id, this);
  }
}

class AddHeader extends FlexContext<AddHeaderRoot> {
  onResponseHeaders(a: u32, end_of_stream: bool): FilterHeadersStatusValues {
    this.addResponseHeader("x-greeting", this.getRootContext().getPolicyConfig().greeting);
    return FilterHeadersStatusValues.Continue;
  }
}

registerRootContext((context_id: u32) => {
  return new AddHeaderRoot(
    context_id,
    new Config()
  );
}, "main");