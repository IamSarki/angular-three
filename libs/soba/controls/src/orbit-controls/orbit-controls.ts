import {
    Component,
    computed,
    CUSTOM_ELEMENTS_SCHEMA,
    effect,
    EventEmitter,
    inject,
    Input,
    Output,
} from '@angular/core';
import {
    injectBeforeRender,
    injectNgtRef,
    NgtArgs,
    NgtSignalStore,
    NgtStore,
    type NgtCamera,
    type NgtVector3,
} from 'angular-three';
import { OrbitControls } from 'three-stdlib';

export type NgtsOrbitControlsState = {
    camera?: THREE.Camera;
    domElement?: HTMLElement;
    target?: NgtVector3;
    makeDefault: boolean;
    regress: boolean;
    enableDamping: boolean;
    keyEvents: boolean | HTMLElement;
};

declare global {
    interface HTMLElementTagNameMap {
        'ngts-orbit-controls': OrbitControls & NgtsOrbitControlsState;
    }
}

@Component({
    selector: 'ngts-orbit-controls',
    standalone: true,
    template: ` <ngt-primitive *args="args()" ngtCompound [enableDamping]="damping()" /> `,
    imports: [NgtArgs],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class NgtsOrbitControls extends NgtSignalStore<NgtsOrbitControlsState> {
    @Input() controlsRef = injectNgtRef<OrbitControls>();

    @Input() set camera(camera: THREE.Camera) {
        this.set({ camera });
    }

    @Input() set domElement(domElement: HTMLElement) {
        this.set({ domElement });
    }

    @Input() set makeDefault(makeDefault: boolean) {
        this.set({ makeDefault });
    }

    @Input() set regress(regress: boolean) {
        this.set({ regress });
    }

    @Input() set target(target: THREE.Vector3 | Parameters<THREE.Vector3['set']>) {
        this.set({ target });
    }

    @Input() set enableDamping(enableDamping: boolean) {
        this.set({ enableDamping });
    }

    @Input() set keyEvents(keyEvents: boolean) {
        this.set({ keyEvents });
    }

    @Output() change = new EventEmitter<THREE.Event>();
    @Output() start = new EventEmitter<THREE.Event>();
    @Output() end = new EventEmitter<THREE.Event>();

    readonly #store = inject(NgtStore);

    readonly args = computed(() => [this.controlsRef.nativeElement]);
    readonly damping = this.select('enableDamping');

    constructor() {
        super({ enableDamping: true, regress: false, makeDefault: false, keyEvents: false });
        injectBeforeRender(
            () => {
                const controls = this.controlsRef.untracked;
                if (controls && controls.enabled) {
                    controls.update();
                }
            },
            { priority: -1 }
        );

        this.#setControls();
        this.#connectElement();
        this.#makeControlsDefault();
        this.#setEvents();
    }

    #setControls() {
        const camera = this.select('camera');
        const defaultCamera = this.#store.select('camera');
        const trigger = computed(() => ({ camera: camera(), defaultCamera: defaultCamera() }));

        effect(
            () => {
                const { camera, defaultCamera } = trigger();
                const controlsCamera = camera || defaultCamera;
                const controls = this.controlsRef.nativeElement;
                if (!controls || controls.object !== controlsCamera) {
                    this.controlsRef.nativeElement = new OrbitControls(controlsCamera as NgtCamera);
                }
            },
            { allowSignalWrites: true }
        );
    }

    #connectElement() {
        const glDomElement = this.#store.select('gl', 'domElement');
        const domElement = this.select('domElement');
        const regress = this.select('regress');
        const invalidate = this.#store.select('invalidate');
        const keyEvents = this.select('keyEvents');

        const trigger = computed(() => {
            const eventsSource = this.#store.get('events', 'connected');
            return {
                keyEvents: keyEvents(),
                controls: this.controlsRef.nativeElement,
                domElement: domElement() || eventsSource || glDomElement(),
                regress: regress(),
                invalidate: invalidate(),
            };
        });

        effect((onCleanup) => {
            const { domElement, controls, keyEvents } = trigger();
            if (!controls) return;
            if (keyEvents) {
                controls.connect(keyEvents === true ? domElement : keyEvents);
            } else {
                controls.connect(domElement);
            }
            onCleanup(() => void controls.dispose());
        });
    }

    #makeControlsDefault() {
        const makeDefault = this.select('makeDefault');
        const trigger = computed(() => ({ controls: this.controlsRef.nativeElement, makeDefault: makeDefault() }));

        effect(
            (onCleanup) => {
                const { controls, makeDefault } = trigger();
                if (!controls) return;
                if (makeDefault) {
                    const oldControls = this.#store.get('controls');
                    this.#store.set({ controls });
                    onCleanup(() => void this.#store.set({ controls: oldControls }));
                }
            },
            { allowSignalWrites: true }
        );
    }

    #setEvents() {
        const invalidate = this.#store.select('invalidate');
        const performance = this.#store.select('performance');
        const regress = this.select('regress');

        const trigger = computed(() => ({
            invalidate: invalidate(),
            performance: performance(),
            regress: regress(),
            controls: this.controlsRef.nativeElement,
        }));
        effect((onCleanup) => {
            const { controls, invalidate, performance, regress } = trigger();
            if (!controls) return;
            const changeCallback: (e: THREE.Event) => void = (e) => {
                invalidate();
                if (regress) performance.regress();
                if (this.change.observed) this.change.emit(e);
            };

            const startCallback = this.start.observed ? this.start.emit.bind(this.start) : null;
            const endCallback = this.end.observed ? this.end.emit.bind(this.end) : null;

            controls.addEventListener('change', changeCallback);
            if (startCallback) controls.addEventListener('start', startCallback);
            if (endCallback) controls.addEventListener('end', endCallback);

            onCleanup(() => {
                controls.removeEventListener('change', changeCallback);
                if (startCallback) controls.removeEventListener('start', startCallback);
                if (endCallback) controls.removeEventListener('end', endCallback);
            });
        });
    }
}
