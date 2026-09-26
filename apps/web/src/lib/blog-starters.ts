/**
 * Two evergreen how-to articles an admin can import as DRAFTS and edit before publishing.
 * They contain practical guidance only: no statistics, prices, quotes or claims about real companies.
 */
export type StarterPost = {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  body: string;
};

export const STARTER_POSTS: StarterPost[] = [
  {
    slug: "how-to-write-an-rfq-that-gets-comparable-quotes",
    title: "How to write an RFQ that gets quotes you can actually compare",
    excerpt:
      "Most quote comparisons fail before the first reply arrives: the request was vague, so every supplier answered a slightly different question. Here is how to write one they can all answer the same way.",
    tags: ["rfq", "buying-guide"],
    body: `A request for quotation is only as good as the questions in it. When two suppliers price "cement, 200 bags" they may be pricing different grades, different delivery terms and different payment conditions, and the cheaper number tells you nothing. The fix is to remove the guesswork before you send the request.

## Say exactly what you need

Name the product the way a supplier's catalogue would: type, grade or class, size, and the standard it must meet if one applies. "Reinforcement bar" is a category; "12 mm deformed bar, the grade your engineer specified" is a request. If your drawings or specification sheet define it, attach them or quote the reference so nobody has to interpret.

Give the quantity in one unit and say what that unit is. Bags, tonnes, cubic metres and pieces are not interchangeable, and a supplier who converts for you may convert differently from the next one.

## Fix the things that change the price

Three details move a price more than most buyers expect. State **where** the goods go, because delivery is often the largest variable. State **when** you need them, because a firm date and an "as soon as possible" are priced differently. And state **how much** you will buy over time if the order will repeat, since a supplier can only offer a volume price if they know the volume.

## Ask every supplier to answer the same way

List the points you want confirmed in each reply, so that the answers line up in a table:

- Unit price and whether VAT is included
- Delivery charge, shown separately
- How long the price is valid
- Quantity actually available, and lead time if not in stock
- Minimum order quantity
- Payment terms

If a supplier cannot meet part of the request, the useful answer is a clear "no" on that line, not a silent substitution.

## Leave room for alternatives, on purpose

Sometimes a supplier stocks an equivalent product that is cheaper or available sooner. Say up front whether alternatives are welcome and what "equivalent" means for you. Ask for them as a separate line so you can compare like with like and decide, rather than discovering the substitution in the invoice.

## Keep the deadline realistic

A response window that is too short tends to produce fewer and rougher quotes. Give suppliers enough time to check stock and transport, and tell them the date you will decide.

## Before you send

Read the request as if you were a supplier who has never met you. Could you price it without phoning to ask a question? If not, that question belongs in the request.`,
  },
  {
    slug: "how-to-read-a-materials-quote-before-you-accept",
    title: "How to read a materials quote before you accept it",
    excerpt:
      "The lowest total is not always the best quote. A short checklist for spotting what a price includes, what it leaves out, and what could change after you say yes.",
    tags: ["quotes", "buying-guide"],
    body: `A quote is a set of promises with a price attached. Reading it well means checking the promises, not just the number at the bottom.

## Start with what is being priced

Confirm that each line matches what you asked for: the same product, grade, size and unit. A lower price on a different specification is not a saving, it is a different purchase. If a line says "or equivalent", ask what the equivalent is before you accept.

## Work out the real total

Put every quote on the same basis before comparing:

- Is VAT included or added on top?
- Is delivery included, or charged separately?
- Are there fees for offloading, pallets, cutting or minimum-order top-ups?
- Is the price per unit you will actually buy, or per a different pack size?

Only when all quotes are on the same basis does the total mean something.

## Check availability and timing

A good price on stock that is not there is not a good price. Look at how much the supplier can supply now, and how long the rest takes. If you need the goods in stages, ask whether the price holds for each stage or only for the first delivery.

## Look at how long the price holds

Material prices can move. A quote with a short validity is a reason to decide quickly, and one with no stated validity is a reason to ask. Get the date in writing.

## Understand the conditions

Read the payment terms, the cancellation and return conditions, and what happens if a delivery arrives damaged or short. You do not need a lawyer for a routine order, but you do need to know who carries the risk at each step.

## Consider the supplier, not only the price

Look at how quickly they replied, whether they answered every point you asked about, and what other buyers say after completed orders. A slightly higher price from a supplier who delivers on the agreed day is often cheaper than a low price that delays your crew.

## When two quotes are close

Ask the supplier you prefer whether they can improve delivery timing or payment terms. Many will, and it costs nothing to ask.`,
  },
];
