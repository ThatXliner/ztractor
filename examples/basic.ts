import { extractMetadata } from "ztractor-node";
// or: import { extractMetadata } from 'ztractor-node';
const file = Bun.file("./example.html");
const result = await extractMetadata({
  url: "https://www.researchgate.net/publication/231756560_Kantian_nonideal_theory_and_nuclear_proliferation",
  html: await file.text(),
});

if (result.success && result.items) {
  const item = result.items[0];
  console.log(item.title); // Article title
  console.log(item.creators); // Authors
  console.log(item.date); // Publication date
  console.log(item.itemType); // "newspaperArticle"
}
