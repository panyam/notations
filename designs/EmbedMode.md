# Embed Mode

## Background

Currently the Notations DSL is designed purely with the Notations as being the hero.   Ie if the user comes to the,
starts typing in the composer - it is all they need to do and they have a printable/viewable MD.

But we have a few intersecting features that may make embedding also be useful.

1. Templating - Ability to make notations be controlled by templates (eg a template may specify how many times to render
   something - for kalams in a pallavi etc).  Or even have notation be template aware so it can include variables
   "somehow"
2. Front Matter - Centralizing and making metadata outside instead of embedding for simplicity
3. Notebooking - I might already have a blogging platform where I am creating content in MD - i just want to embed and
   let a plugin handle it instead.


## Goals 

* Our syntax is still hero so the goal now is to see what is compatible with embeddability.
* Is any restriction or extension needed to syntax to make it amenable to embeddability
* How do we migrate old notations to this.

## Options

### Embedding in HTML

Have a "<notation>" tag.  Can be used in both md and html.  Idea is the final notation node is loaded when the page is
loaded inside which ever div is desired.

eg: 

```
<notation>

> ---
> #### Pallavi

Sw:
s. , , - s. n d - p d n - n d p m g - m n n d p - m g r s r g m p - g m p d n
s.r.g.-n s.r. - d n d - g.r.s.n d p m d , , , , , - s.n d p m - g m p d n

Sh:
Ē , , rā , , nā , , pai , , , , in tha chou , , ka , , sē , , , , ya , , , , 
Mē , , ra , , kā , , du , , rā , , , nā , , , , , sā , , , , mi , , , , 

> #### Anu Pallavi

Sw:
n d d n d d n - g m n d p m g r s m g m - p d n s. n d p d n s. , - d p 
d n s.r.g.r.-g.m.g.r.- n g.r.s.n d n s.r.- d n d - g.r.s.n d p m p d n

Sh:
Ma , , , ru , , ni , kan , , na , , , Sree , , Ven , , ka , tē , , , sā , - Su ku
mā , , , ra , nan , , , nē , , , lu , kō , , rā , , sa , ra , su , , dā , , 

</notation>
```

We may also want to do this via mark down (say a special fence  ```notation ... ````)

```
'''notation.

> ---
> #### Pallavi

Sw:
s. , , - s. n d - p d n - n d p m g - m n n d p - m g r s r g m p - g m p d n
s.r.g.-n s.r. - d n d - g.r.s.n d p m d , , , , , - s.n d p m - g m p d n

Sh:
Ē , , rā , , nā , , pai , , , , in tha chou , , ka , , sē , , , , ya , , , , 
Mē , , ra , , kā , , du , , rā , , , nā , , , , , sā , , , , mi , , , , 

> #### Anu Pallavi

Sw:
n d d n d d n - g m n d p m g r s m g m - p d n s. n d p d n s. , - d p 
d n s.r.g.r.-g.m.g.r.- n g.r.s.n d n s.r.- d n d - g.r.s.n d p m p d n

Sh:
Ma , , , ru , , ni , kan , , na , , , Sree , , Ven , , ka , tē , , , sā , - Su ku
mā , , , ra , nan , , , nē , , , lu , kō , , rā , , sa , ra , su , , dā , , 

'''
```

Unlike a "full page" song - it may be important to "link" notations so that attributes can be carried over from one
block to another (eg if we want to share beat info or synchronize cell widths etc).
