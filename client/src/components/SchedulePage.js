import React, { useState } from 'react';
import './SchedulePage.css';

const SchedulePage = () => {
  const [scheduleText, setScheduleText] = useState('');

  const handleSave = () => {
    // TODO: Implement save logic
    alert('저장되었습니다!');
  };

  return (
    <div className="schedule-page">
      <p>인스타그램, 페이스북 등에서 공연일정 내용을 복사하여 아래에 붙여넣으세요.</p>
      <textarea
        className="schedule-textarea"
        value={scheduleText}
        onChange={(e) => setScheduleText(e.target.value)}
        placeholder="여기에 공연일정을 붙여넣으세요..."
      />
      <button className="save-button" onClick={handleSave}>
        저장
      </button>
    </div>
  );
};

export default SchedulePage;