# Vault Graph and Links

## The idea

The Career Profile should behave like a typed, professional knowledge graph that the user experiences as a Markdown vault.

A user can write naturally:

> I built the [[Unity Awards]] using [[React Router 7]].

`Unity Awards` leads to the full project context. `React Router 7` leads to a skill note that can hold fluency, years of use, certifications, examples, related technologies, and evidence of use.

The links make the profile navigable and give currnt a better way to understand the user's experience when assessing a job or drafting an application document.

## What can be linked

The vault can support notes for:

- Roles and employers.
- Projects, programmes, products, and initiatives.
- Achievements and evidence.
- Skills, tools, methods, and technologies.
- Certifications, education, and qualifications.
- Domains, industries, and professional themes.

Each item has a stable identity, rich Markdown content, and a type. The type gives currnt enough context to use it appropriately without making the writing experience feel like a database form.

## Two kinds of connection

### Reference links

A normal `[[wiki link]]` means: "these things are related in this context."

It is lightweight. It creates backlinks, makes exploration easier, and helps currnt find related context. It should not automatically assert a strong factual relationship.

For example, linking `[[React Router 7]]` from a project says it was relevant to the project. It does not automatically mean the user is an expert in it.

### Confirmed relationships

Some relationships matter enough to be explicit and queryable. These include:

- An achievement belongs to a role.
- An achievement was delivered through a project.
- An achievement demonstrates a skill.
- A certification supports a skill.
- A project used a technology.
- A CV claim is grounded in a specific item of evidence.

These can be created through an intentional action in the interface, or suggested for user confirmation. They should be stored as real relations in Postgres, not inferred forever from strings in Markdown.

## How deep to go

Go deep where a connection is reusable, meaningful, or useful to a future decision. Do not demand a perfect graph.

Good candidates for links:

- A project that may be relevant to many future roles.
- A skill with evidence across several roles or projects.
- A specific achievement with a meaningful metric or outcome.
- A certification that strengthens a professional claim.
- A domain that helps explain career direction.

Poor candidates for required links:

- Every casual mention of a tool.
- Generic verbs, routine responsibilities, or filler context.
- A technology the user touched once but does not want to represent as a skill.

The user should be able to write first and connect later. Suggested links can make organisation easier, but no one should have to curate a complete ontology before their profile is useful.

## Skill notes

A skill note should be more than a tag. It is the place to understand the user's relationship with that skill.

It may include:

- What the user can do with it and at what level.
- Years, recency, and depth of experience.
- Relevant projects and roles.
- Certifications or formal learning.
- Particular outcomes or evidence it supported.
- Related skills and technologies.

A job assessment can then distinguish "mentioned React Router 7 once" from "used it across two projects and can speak credibly about it."

## Relationship to generation

Links should help currnt retrieve context, not make automatic claims.

For a job requiring a skill, currnt can move from the skill note to related projects and evidence, then show the user what it selected. The user can add, remove, or correct that context before it is used in an assessment, CV, or cover letter.

## Questions to keep open

- How should a user promote a plain-text mention into a link with almost no interruption?
- Which confirmed relationship types are genuinely useful in the first version?
- When should currnt suggest a link, and when would that feel noisy or presumptuous?
- How should the interface communicate a reference link versus a confirmed professional claim?

## Related

- [[Career Profile]]
- [[00 Foundations/Working Language|Working Language]]
- [[02 Shared Capabilities/AI and Prompts|AI and Prompts]]
