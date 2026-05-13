import { ref } from "../define-fixtures.js";

// activerecord/test/fixtures/topics.yml
export const topicFixtureData = {
  first: {
    title: "The First Topic",
    author_name: "David",
    content: "Have a nice day",
    approved: false,
    replies_count: 1,
    type: "Topic",
  },
  second: {
    title: "The Second Topic of the day",
    author_name: "Mary",
    approved: true,
    replies_count: 0,
    parent_id: ref("topics", "first"),
    type: "Reply",
  },
  third: {
    title: "The Third Topic of the day",
    author_name: "Carl",
    approved: true,
    replies_count: 1,
  },
  fourth: {
    title: "The Fourth Topic of the day",
    author_name: "Carl",
    approved: true,
    parent_id: ref("topics", "third"),
    type: "Reply",
  },
  fifth: {
    title: "The Fifth Topic of the day",
    author_name: "Jason",
    approved: true,
  },
};
