import { Item, AppliedLabel } from '../model';

export interface ILabeler {
  name(): string;
  apply(item: Item, args: any): Promise<AppliedLabel[]>;
}

export type LabelerFactory = (args: any) => ILabeler;
