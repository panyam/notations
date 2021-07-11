
Cursors indicate "locations" into points in a document tree.
Insertions/Deletions/Edits happen via the entities around the
locations instead of on the entities directly.  This way we
can track changes to the overall tree instead of just depending
on Events.  Events have their applications but in an editor system
the edits are what enforce document changes so listening to an event
which was created by an edit would be too cumbersome (how cumbersome?).

Cursor's are identified by their index paths.  Index paths point a path
from root to node where the next insertion/deletion/update can be performed.

Consider the following tree:

```
 A
 - B1
   - C1
   - C2
     - E1
     - E2
   - C3
 - B2
   - D1
   - D2
   - D3
     - F1
     - F2
```

A cursor "at" C2 would have an index path if [0, 0, 1] (indicating A.B1.C2).

At this cursor the following are possible:
1. Inserting (of C4) would occur as a sibling of C2 (between C2 and C3).
2. Deletion would result in C3 (all of its children) being destroyed.
3. An update would result in C2 being updated (along with its children if needed).

How do we add a child?  Say if a child needs to be added to E2 (whose cursor is [0, 0, 1, 1]) we would need a cursor into the child list of E2 - [0, 0, 1, 1, X].  X would be the position "BEFORE" which the insertion would occur.  In this case it could be "0" to indicate that an insertion should occur before index 0 (pushing any children from 0 onwards forward by 1).  An index of CURSOR_END could be used to "append" entries at the end. Doing this (instead of -1) helps us easily sort indexes.

Similar when a deletion occurs the value at the given index is deleted.  Deletion at the index of CURSOR_END would have no effect.

While we can do edits "at" the cursor indices.  How would the indices themselves change based on the edits?

For example if the index (of the cursor) was a non negative value, say 1 to indicate a cursor in between E1 and E2 above.  Then an inertion should result in the cursor's position being incremented by 1.  If the cursor index was -ve then an insertion or deletion sould have no effect.

Similarly for a non negative index a deletion at the cursor should decrement the cursor
index.

What happens when we have multiple cursors?  Cursors are simply markers into a tree.  Any cursor whose index paths "cross" will have to be updated.  Cursors will be "sorted" based on the pre-order traversal of nodes in our tree.

So what are our flows/use cases.

1. user creates a notebook - an empty document with a collection of
Scores that can be embedded inside another document in pieces
(like html or md).

2. At the start the Notebook (say like a word doc) is empty and has a single cursor (pointing at the start) where content can be added.
3. There are two kinds of content - Leafs and Commands.  Leafs are notes and actual elements that produce music (and other rendering artifacts.  Commands are content that modify the actual DOM/Tree of the doc.  For simplicity (and without much loss of generality) our cursors are only modified by Commands and not leafs (which will be added into the lowest level - the Lines).
4. When a command is run it begins to make changes to the Doc *from the point* of a cursor.

Before a user can add content, they have to obtain a cursor from which content can be added.  When a user obtains a cursor the user is essentially creating a (non overlapping) "window" into the document to add content - bit like a offset in a write ahead log.

Let us call this window the Snippet.

```
x = notebook.newSnippet()
```

Here a new window is created with cursor range being

```
[ notebook.cursor(), notebook.cursor.clone() ]
```

This is currently a "0" length range.

The user can also do another snippet now which will have a range

```
[ notebook.cursor(), notebook.cursor.clone() ]
```

Note that even though all the four cursors have the same value
they are not the same instance.  As snippets x and y begin to
add content the values in these cursors will begin to change
while maintaining the non-overlapping-cursors invariant.

Say if we now did:

```
x.addScore()
```

Here our notbook now has a new item the score, and x.endCursor is
incremented to be at the end of the score.

We can descend a level by doing: ``` x.addSection() ```

Here our cursor has an extra index - pointing "into" the score.

so x.startCursor is [-1] as before and x.endCursor is [0, -1]

What happens to y's cursors here?

Since all cursors are maintained in a sorted order within the
notebook any shift of one cursor affects all cursors after it.

so y's range here after the first edit would have been:

[-1] - so adds would have been "after" the score (unless we descended)

and [0, -1] after the second edit (to indicate that we are appending
to the same score as was created in x

endCursor would be same as startCursor for y as nothing was added.

This assumes all edits are happening via the editor and we are not
allowing any out of band edits (say via api).



----------------------------------------------------------------------


```
// Cursor, C = [0], Next insertion (of score only) at child 0 
//                  of corresponding entity in Entity Stack
// Entity Stack, ES = [x]
x = new Notebook(); 


// Curr Cursor = C
// "Next" Cursor = N (which is null currently)
x.ensureScore();

// L = C.lastIndex
// While ES.top().type != network:
//    L--;
//    ES.pop()
// if L >= C.indexes.length():
//    insert score at ES.top().child[0]
//    C.push(0)
// else:
//    Set score at ES.top().child[C[L - 1]] to new score
//    C[L - 1]++;
//    Delete C[L:]
//
// if N exists adjust it accordingly by decrementing or incrementing

popUntil(EntityType);

x.ensureScore();    // C = 1 (next insertion at index 2)
x.ensureSection();  // C = [1, 0]
x.ensureLine();     // C = [1, 0, 0]
x.ensureScore();    // popTill(Network) => C = [1] adn then C[1] ++;
                    // so C = [2], next insertion at index 3
x.ensureLine();     // line calls ensure Section which pops until

