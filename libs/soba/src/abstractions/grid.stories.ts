import { CUSTOM_ELEMENTS_SCHEMA, Component } from '@angular/core';
import { Meta, moduleMetadata } from '@storybook/angular';
import { NgtsGrid } from 'angular-three-soba/abstractions';
import { StorybookSetup, makeStoryFunction } from '../setup-canvas';

@Component({
    standalone: true,
    template: `
        <ngts-grid cellColor="white" [args]="[10, 10]" />
        <ngt-mesh [position]="[0, 0.5, 0]">
            <ngt-box-geometry />
            <ngt-mesh-standard-material />
        </ngt-mesh>
        <ngt-directional-light [position]="[10, 10, 5]" />
    `,
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    imports: [NgtsGrid],
})
class DefaultGridStory {}

export default {
    title: 'Gizmo/Grid',
    decorators: [moduleMetadata({ imports: [StorybookSetup] })],
} as Meta;

export const Default = makeStoryFunction(DefaultGridStory, { camera: { position: [-5, 5, 10] } });
