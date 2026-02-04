/**
 * Bidirectional nickname mapping
 */

const nicknameGroups = [
  ['james', 'jim', 'jimmy', 'jamie'],
  ['robert', 'bob', 'bobby', 'rob', 'robbie'],
  ['william', 'bill', 'billy', 'will', 'willy', 'liam'],
  ['richard', 'rick', 'ricky', 'dick', 'rich'],
  ['elizabeth', 'liz', 'lizzy', 'beth', 'betty', 'eliza'],
  ['michael', 'mike', 'mikey', 'mick'],
  ['david', 'dave', 'davey'],
  ['joseph', 'joe', 'joey'],
  ['thomas', 'tom', 'tommy'],
  ['charles', 'charlie', 'chuck', 'chas'],
  ['christopher', 'chris', 'kit'],
  ['daniel', 'dan', 'danny'],
  ['matthew', 'matt', 'matty'],
  ['anthony', 'tony'],
  ['donald', 'don', 'donnie'],
  ['steven', 'steve', 'stephen'],
  ['edward', 'ed', 'eddie', 'ted', 'teddy'],
  ['kenneth', 'ken', 'kenny'],
  ['ronald', 'ron', 'ronnie'],
  ['margaret', 'peggy', 'maggie', 'meg', 'marge'],
  ['patricia', 'pat', 'patty', 'trish'],
  ['jennifer', 'jen', 'jenny'],
  ['catherine', 'kate', 'kathy', 'cathy', 'katherine', 'kathryn'],
  ['susan', 'sue', 'susie', 'suzy'],
  ['nancy', 'nan'],
  ['barbara', 'barb', 'barbie'],
  ['dorothy', 'dot', 'dottie'],
  ['deborah', 'deb', 'debbie', 'debra'],
  ['sandra', 'sandy'],
  ['linda', 'lindy'],
  ['theodore', 'theo', 'ted', 'teddy'],
  ['alexander', 'alex', 'sandy'],
  ['benjamin', 'ben', 'benny'],
  ['samuel', 'sam', 'sammy'],
  ['frederick', 'fred', 'freddy', 'fritz'],
  ['gerald', 'jerry', 'gerry'],
  ['harold', 'harry', 'hal'],
  ['lawrence', 'larry'],
  ['nicholas', 'nick', 'nicky'],
  ['raymond', 'ray'],
  ['walter', 'walt', 'wally'],
  ['virginia', 'ginny', 'ginger'],
  ['rebecca', 'becky', 'becca'],
  ['victoria', 'vicky', 'tori'],
  ['jacqueline', 'jackie'],
  ['judith', 'judy', 'judi'],
  ['joanne', 'jo', 'joann'],
  ['helen', 'ellie', 'ella'],
  ['ruth', 'ruthie'],
];

// Build lookup map
const nicknameMap = new Map();

for (const group of nicknameGroups) {
  const groupSet = new Set(group);
  for (const name of group) {
    const existing = nicknameMap.get(name);
    if (existing) {
      for (const n of group) existing.add(n);
    } else {
      nicknameMap.set(name, new Set(groupSet));
    }
  }
}

/**
 * Get all nickname variants for a given name
 */
function getNicknameVariants(name) {
  const normalized = name.toLowerCase().trim();
  const variants = nicknameMap.get(normalized);
  if (variants) {
    return Array.from(variants);
  }
  return [normalized];
}

/**
 * Check if two names are nickname variants of each other
 */
function areNicknameVariants(name1, name2) {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  if (n1 === n2) return true;

  const variants = nicknameMap.get(n1);
  return variants ? variants.has(n2) : false;
}

/**
 * Check if name2 is a nickname variant of name1 (but not an exact match)
 */
function isNicknameMatch(name1, name2) {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  if (n1 === n2) return false;  // Exact match, not nickname match

  const variants = nicknameMap.get(n1);
  return variants ? variants.has(n2) : false;
}

module.exports = {
  getNicknameVariants,
  areNicknameVariants,
  isNicknameMatch
};
