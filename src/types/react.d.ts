// Type declarations for React (since it's a peer dependency)
declare module 'react' {
  export interface FC<P = object> {
    (props: P): JSX.Element | null;
  }

  export interface Context<T> {
    Provider: FC<{ value: T; children?: ReactNode }>;
    Consumer: FC<{ children: (value: T) => ReactNode }>;
  }

  export type ReactNode =
    | ReactElement
    | string
    | number
    | boolean
    | null
    | undefined
    | ReactNode[];

  export interface ReactElement<P = any> {
    type: any;
    props: P;
    key: string | null;
  }

  export type SetStateAction<S> = S | ((prevState: S) => S);
  export type Dispatch<A> = (value: A) => void;

  export function createContext<T>(defaultValue: T): Context<T>;
  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useCallback<T extends (...args: any[]) => any>(
    callback: T,
    deps: readonly any[]
  ): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function useContext<T>(context: Context<T>): T;
  export function useMemo<T>(factory: () => T, deps: readonly any[]): T;
}

// React Native component type fixes
declare module 'react-native' {
  export const View: any;
  export const Text: any;
  export const Image: any;
  export const TextInput: any;
  export const TouchableOpacity: any;
  export const ScrollView: any;
  export const FlatList: any;
  export const StyleSheet: any;
  export const Platform: any;
  export const Modal: any;
  export const KeyboardAvoidingView: any;
  export const RefreshControl: any;

  export namespace Animated {
    export class Value {
      constructor(value: number);
      setValue(value: number): void;
    }
    export const View: any;
    export function loop(animation: any): any;
    export function sequence(animations: any[]): any;
    export function delay(duration: number): any;
    export function timing(value: Value, config: any): any;
  }
}

declare namespace JSX {
  interface Element extends React.ReactElement<any, any> {}
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
