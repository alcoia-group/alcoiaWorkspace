// The reporting-mode notice is the promise made to the student, and it cannot
// be changed after they join. It is shown, in full, before there is any way to
// join (the join button is rendered inside this component's ready state only).
export default function ReportingNotice({ className = 'this class', reportingMode }) {
  return (
    <div className="notice" role="region" aria-label="What your instructor can see">
      <h2>What your instructor can see</h2>
      {reportingMode === 'identified' ? (
        <>
          <p>
            In <strong>{className}</strong>, your instructor sees <strong>individual results</strong>:
            which parts of a reading you found hard and how you answered the questions, with your name
            on them.
          </p>
          <p>
            This was set when the class was created and cannot be changed after you join. If you would
            rather not be seen individually, do not join this class.
          </p>
        </>
      ) : (
        <>
          <p>
            In <strong>{className}</strong>, your instructor sees <strong>aggregate results only</strong>,
            things like “most of the class found section 2 hard.” Nothing about your own reading,
            individually, is visible to them.
          </p>
          <p>
            Reading receipts are not used in this class: your instructor cannot see or receive one from
            you.
          </p>
        </>
      )}
    </div>
  );
}
