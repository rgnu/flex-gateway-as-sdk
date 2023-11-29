How to use the SDK:


# Local development
Clone this repo to somewhere on disk.

Create a new project:
```shell
npm install --save-dev assemblyscript@0.19.22
npx asinit .
```

add `--use abort=abort_proc_exit --transform @serial-as/transform` to the `asc` in packages.json. for example:
```json
    "asbuild": "asc assembly/index.ts -b build/optimized.wasm --use abort=abort_proc_exit --transform @serial-as/transform --optimize",
```

Add `"@rgnu/flex-gateway-as-sdk": "https://github.com/rgnu/flex-gateway-as-sdk.git"` to your dependencies.
run `npm install`

# using NPM

Just include the `@rgnu/flex-gateway-as-sdk` package.

# Hello, World

## Code
Copy this into assembly/index.ts:

```ts
//@ts-ignore
export * from "@rgnu/flex-gateway-as-sdk/proxy"; // this exports the required functions for the proxy to interact with us.

import { Context, FilterHeadersStatusValues, FlexContext, FlexRootContext, registerRootContext } from "@rgnu/flex-gateway-as-sdk";

class Config {
    greeting: string = "Hello!"
}

class AddHeaderRoot extends FlexRootContext {
  createContext(context_id: u32): Context {
    return new AddHeader(context_id, this);
  }
}

class AddHeader extends FlexContext<AddHeaderRoot> {
  onResponseHeaders(a: u32, end_of_stream: bool): FilterHeadersStatusValues {
    this.addResponseHeader("x-greeting", "Hello!")
    return FilterHeadersStatusValues.Continue;
  }
}

registerRootContext((context_id: u32) => { return new AddHeaderRoot(context_id); }, "main");
```
## build

To build, simply run:
```
npm run asbuild
```

build results will be in the build folder. `optimized.wasm` are the compiled 
file that we will use.

## Run
Configure envoy with your filter:
```yaml
          - name: envoy.filters.http.wasm
            config:
              config:
                name: "add_header"
                root_id: "main"
                configuration: "what ever you want"
                vm_config:
                  vm_id: "my_vm_id"
                  runtime: "envoy.wasm.runtime.v8"
                  code:
                    local:
                      filename: /PATH/TO/CODE/build/optimized.wasm
                  allow_precompiled: false
```
