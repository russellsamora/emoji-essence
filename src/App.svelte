<script>
  import emojiData from "./emojis";
  export let title;
  let prev = null;
  let emoji = null;
  let name = null;
  let visible = false;

  function createMark(prev, cur) {
    const pre = prev.str.substring(0, prev.index);
    const after = prev.str.substring(prev.index, prev.str.length);
    const end = after.toLowerCase().indexOf(cur);
    const inject = after.substring(0, end);
    const post = after.substring(end + 1);

    const str = `${pre}${inject}<mark>${cur}</mark>${post}`;
    const index = str.length - post.length;
    return { str, index };
  }

  function createConsecutive(prev, cur) {
    const pre = prev.str.substring(0, prev.index);
    const after = prev.str.substring(prev.index, prev.str.length);
    const end = after.toLowerCase().indexOf(cur);
    const inject = after.substring(0, end);
    const post = after.substring(end + 1);

    const str = `${pre}${inject}~${post}`;
    const index = str.length - post.length;
    return { str, index };
  }

  function getEmoji(i) {
    if (!i.length) return null;

    const chars = [...i];
    const exp = chars.map(d => `.*${d}`).join("");
    const reg = new RegExp(exp, "i");
    const filtered = emojiData.filter(d => reg.test(d.shortname));

    if (!filtered.length) return null;

    const withProps = filtered.map(d => {
      const { shortname } = d;
      const [match] = shortname.match(reg);
      const start = shortname.indexOf(chars[0]);
      const end = match.length;
      const sub = shortname.substring(start, end);
      const len = sub.length;
      const r = { str: shortname, index: 0 };
      const con = Math.max(
        ...chars
          .reduce(createConsecutive, r)
          .str.match(/(~+)/g, "")
          .map(v => v.length)
      );
      return { ...d, len, con };
    });

    withProps.sort((a, b) => {
      // most consequetive
      const c = a.con - b.con;
      if (c !== 0) return c;
      // shortest total
      const n = b.len - a.len;
      if (n !== 0) return n;
      // lowest index
      return +b.number - +a.number;
    });

    const top = withProps.pop();
    const r = { str: top.shortname, index: 0 };
    top.marked = chars.reduce(createMark, r).str;

    return top;
  }

  function handleInput() {
    const input = this.value.replace(/\W/g, "");
    if (!input.length) prev = null;

    const output = getEmoji(input.toLowerCase()) || prev;

    if (output) {
      emoji = output.browser;
      name = output.marked;
      prev = output;
    }

    visible = !!output ? "is-visible" : "";
  }
</script>

<style>
  main {
    max-width: 60rem;
    margin: 0 auto;
    padding: 1rem;
  }

  h1 {
    font-size: 2em;
    line-height: 1.2;
    margin: 0;
    text-align: center;
  }

  input {
    font-size: 1.25em;
    display: block;
    width: 90%;
    margin: 2rem auto;
    padding: 0.25em;
    max-width: 30rem;
    text-align: center;
  }

  div.output {
    visibility: hidden;
  }

  p.emoji {
    font-size: 6em;
    margin: 1rem 0;
    text-align: center;
    line-height: 1;
  }

  p.name {
    font-size: 1.25em;
    margin: 0;
    text-align: center;
    color: #999;
  }

  div.is-visible {
    visibility: visible;
  }

  p.credit {
    text-align: center;
    font-size: 1em;
    margin-top: 4rem;
  }

  p.source {
    text-align: center;
    font-size: 0.75em;
    color: #666;
    max-width: 19rem;
    margin: 1rem auto;
  }

  @media (min-width: 640px) {
    h1 {
      font-size: 3em;
    }

    p,
    input {
      font-size: 2em;
    }

    p.emoji {
      font-size: 8em;
    }

    p.credit {
      font-size: 1em;
    }

    p.source {
      font-size: 0.75em;
    }
  }
</style>

<main>
  <h1>{title}</h1>
  <input on:input={handleInput} placeholder="Enter your name" />
  <div class="output {visible}">
    <p class="emoji">{emoji}</p>
    <p class="name">
      {@html name}
    </p>
  </div>

  <p class="credit">
    Created by
    <a href="https://twitter.com/codenberg">@codenberg</a>
  </p>

  <p class="source">
    Finds the closest match of your name within an emoji's CLDR Short Name.
    Excludes country flags and ones that don't render in browsers.
    <a
      target="_blank"
      href="https://unicode.org/emoji/charts/full-emoji-list.html">
      Emoji data source
    </a>
  </p>
</main>
