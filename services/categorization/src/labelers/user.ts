import { ILabeler } from './interface';
import { Item, AppliedLabel, UserArgs } from '../model';

export class UserLabeler implements ILabeler {
  name(): string {
    return 'user';
  }

  async apply(_item: Item, _args: UserArgs): Promise<AppliedLabel[]> {
    // User labeler is a no-op - labels are assigned via API
    // This labeler is used when cardinality requires manual assignment
    return [];
  }
}
