export const resolvePlaceholderSubject = (insectType) => {
  switch (insectType) {
    case 'beetle':
    case 'longhornbeetle':
    case 'barkbeetle':
    case 'leafbeetle':
    case 'aphid':
      return 'bug';
    case 'plant':
      return 'sprout';
    case 'moth':
    case 'butterfly':
    default:
      return 'butterfly';
  }
};
