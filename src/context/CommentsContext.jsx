import { createContext, useContext, useState } from "react";
import { nanoid } from "nanoid";

const CommentsContext = createContext(null);

export default function CommentsContextProvider({ children }) {
  const [comments, setComments] = useState([]);

  /**
   * Add a new comment to a table.
   * @param {string} tableId - The id of the table being commented on.
   * @param {string} text - The comment text.
   */
  function addComment(tableId, text) {
    const newComment = {
      id: nanoid(),
      tableId,
      text,
      resolved: false,
      createdAt: new Date().toISOString(),
      author: "You",
    };
    setComments((prev) => [...prev, newComment]);
  }

  /**
   * Mark a comment as resolved.
   * @param {string} id - The comment id.
   */
  function resolveComment(id) {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, resolved: true } : c))
    );
  }

  /**
   * Delete a single comment by id.
   * @param {string} id - The comment id.
   */
  function deleteComment(id) {
    setComments((prev) => prev.filter((c) => c.id !== id));
  }

  /**
   * Delete all comments belonging to a table (called on table deletion).
   * @param {string} tableId - The table id.
   */
  function deleteCommentsForTable(tableId) {
    setComments((prev) => prev.filter((c) => c.tableId !== tableId));
  }

  return (
    <CommentsContext.Provider
      value={{
        comments,
        setComments,
        addComment,
        resolveComment,
        deleteComment,
        deleteCommentsForTable,
      }}
    >
      {children}
    </CommentsContext.Provider>
  );
}

export function useComments() {
  return useContext(CommentsContext);
}
