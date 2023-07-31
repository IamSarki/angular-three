import {
	computed,
	signal,
	untracked,
	type CreateComputedOptions,
	type CreateSignalOptions,
	type Signal,
	type WritableSignal,
} from '@angular/core';
import type { NgtAnyRecord } from '../types';

const STORE_COMPUTED_KEY = '__ngt_signal_store_computed__';

export type NgtSignalStore<State extends object> = {
	select<
		Key1 extends keyof State,
		Key2 extends keyof State[Key1],
		Key3 extends keyof State[Key1][Key2],
		Key4 extends keyof State[Key1][Key2][Key3],
	>(
		key1: Key1,
		key2: Key2,
		key3: Key3,
		key4: Key4,
		options?: CreateComputedOptions<State[Key1][Key2][Key3][Key4]>,
	): Signal<State[Key1][Key2][Key3][Key4]>;
	select<Key1 extends keyof State, Key2 extends keyof State[Key1], Key3 extends keyof State[Key1][Key2]>(
		key1: Key1,
		key2: Key2,
		key3: Key3,
		options?: CreateComputedOptions<State[Key1][Key2][Key3]>,
	): Signal<State[Key1][Key2][Key3]>;
	select<Key1 extends keyof State, Key2 extends keyof State[Key1]>(
		key1: Key1,
		key2: Key2,
		options?: CreateComputedOptions<State[Key1][Key2]>,
	): Signal<State[Key1][Key2]>;
	select<Key extends keyof State>(key: Key, options?: CreateComputedOptions<State[Key]>): Signal<State[Key]>;
	select(options?: CreateComputedOptions<State>): Signal<State>;

	get<
		Key1 extends keyof State,
		Key2 extends keyof State[Key1],
		Key3 extends keyof State[Key1][Key2],
		Key4 extends keyof State[Key1][Key2][Key3],
	>(
		key1: Key1,
		key2: Key2,
		key3: Key3,
		key4: Key4,
	): State[Key1][Key2][Key3][Key4];
	get<Key1 extends keyof State, Key2 extends keyof State[Key1], Key3 extends keyof State[Key1][Key2]>(
		key1: Key1,
		key2: Key2,
		key3: Key3,
	): State[Key1][Key2][Key3];
	get<Key1 extends keyof State, Key2 extends keyof State[Key1]>(key1: Key1, key2: Key2): State[Key1][Key2];
	get<Key extends keyof State>(key: Key): State[Key];
	get(): State;

	set(state: Partial<State> | ((previous: State) => Partial<State>)): void;
	patch(state: Partial<State>): void;

	state: Signal<State>;
};

export function signalStore<State extends object>(
	initialState:
		| Partial<State>
		| ((storeApi: Pick<NgtSignalStore<State>, 'get' | 'set' | 'patch'>) => Partial<State>) = {},
	options?: CreateSignalOptions<State>,
): NgtSignalStore<State> {
	const setter = (_source: WritableSignal<State>) => (state: State | ((previous: State) => State)) => {
		const updater = (previous: State) => {
			const partial = typeof state === 'function' ? state(previous) : state;
			Object.keys(partial).forEach((key) => {
				const typedKey = key as keyof State;
				if (partial[typedKey] === undefined && previous[typedKey] != null) {
					partial[typedKey] = previous[typedKey];
				}
			});
			return partial;
		};
		untracked(() => {
			_source.update((previous) => ({ ...previous, ...updater(previous) }));
		});
	};

	const patcher = (_source: WritableSignal<State>) => (state: State) => {
		const updater = (previous: State) => {
			Object.keys(state).forEach((key) => {
				const typedKey = key as keyof State;
				if (state[typedKey] === undefined && previous[typedKey] != null) {
					state[typedKey] = previous[typedKey];
				}
			});
			return state;
		};
		untracked(() => {
			_source.update((previous) => ({ ...updater(previous), ...previous }));
		});
	};

	const getter =
		(_source: WritableSignal<State>) =>
		(...keys: string[]) => {
			const root = untracked(_source);
			if (keys.length === 0) return root;
			return keys.reduce((value, key) => (value as NgtAnyRecord)[key], root);
		};

	let source: WritableSignal<State>;
	let set: NgtSignalStore<State>['set'];
	let get: NgtSignalStore<State>['get'];
	let patch: NgtSignalStore<State>['patch'];

	if (typeof initialState === 'function') {
		source = signal({} as State, options);
		get = getter(source);
		set = setter(source);
		patch = patcher(source);
		source.set(initialState({ set, get, patch }) as State);
	} else {
		source = signal(initialState as State, options);
		get = getter(source);
		set = setter(source);
		patch = patcher(source);
	}

	const state = source.asReadonly();
	const computedCache = new Map();

	const store = {
		select: (...keysAndOptions: any[]) => {
			if (keysAndOptions.length === 0) return state;
			if (keysAndOptions.length === 1 && typeof keysAndOptions[0] === 'object') {
				const cachedKey = STORE_COMPUTED_KEY.concat(JSON.stringify(keysAndOptions[0]));
				if (!computedCache.has(cachedKey)) {
					computedCache.set(cachedKey, computed(state, keysAndOptions as CreateComputedOptions<object>));
				}
				return computedCache.get(cachedKey)!;
			}
			const [keys, options] = parseStoreOptions(keysAndOptions);
			const joinedKeys = keys.join('-');
			const cachedKeys = joinedKeys.concat(options ? JSON.stringify(options) : '');

			if (!computedCache.has(cachedKeys)) {
				computedCache.set(
					cachedKeys,
					computed(() => keys.reduce((value, key) => (value as NgtAnyRecord)[key], state()), options),
				);
			}
			return computedCache.get(cachedKeys)!;
		},
		get,
		set,
		patch,
		state,
	};

	Object.defineProperty(store, '_snapshot', {
		get: state,
		configurable: false,
		enumerable: false,
	});

	return store;
}

function parseStoreOptions(keysAndOptions: any[]): [string[], CreateComputedOptions<any>?] {
	if (typeof keysAndOptions.at(-1) === 'object') {
		return [keysAndOptions.slice(0, -1), keysAndOptions.at(-1)];
	}

	return [keysAndOptions];
}
