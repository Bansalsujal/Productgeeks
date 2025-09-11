import React from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, getDay } from "date-fns";

export default function ActivityCalendar({ sessions }) {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  
  const activityMap = React.useMemo(() => {
    const map = {};
    if (!sessions || sessions.length === 0) {
      return map;
    }
    
    sessions.forEach((session) => {
      if (session.completed) {
        try {
          const dateToUse = session.date || session.created_date;
          
          if (dateToUse) {
            let dateStr;
            if (dateToUse.includes('T')) {
              dateStr = dateToUse.split('T')[0];
            } else if (dateToUse.includes('-') && dateToUse.length === 10) {
              dateStr = dateToUse;
            } else {
              const sessionDate = new Date(dateToUse);
              dateStr = sessionDate.getFullYear() + '-' + 
                       String(sessionDate.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(sessionDate.getDate()).padStart(2, '0');
            }
            
            map[dateStr] = (map[dateStr] || 0) + 1;
          }
        } catch (error) {
          console.error('Error processing session date:', session, error);
        }
      }
    });
    
    return map;
  }, [sessions]);

  const firstDayOfMonth = getDay(monthStart);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const calendarDays = Array(firstDayOfMonth).fill(null).concat(daysInMonth);

  const getActivityLevel = (count) => {
    if (count === 0) return 'bg-gray-100/80 hover:bg-gray-200/80';
    if (count === 1) return 'bg-green-200/80 hover:bg-green-300/80';
    if (count <= 3) return 'bg-green-400/80 hover:bg-green-500/80';
    return 'bg-green-600/80 hover:bg-green-700/80';
  };

  return (
    <div className="bg-white/50 border border-gray-200/60 rounded-xl p-3">
      <div className="px-1 mb-2">
        <h3 className="font-semibold text-sm text-gray-800">
          {format(today, 'MMMM yyyy')}
        </h3>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1.5">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
            <div key={day} className="text-center text-[10px] font-medium text-gray-500">
              {day}
            </div>
          ))}
          
          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} />;
            }
            
            const isTodayDate = isToday(date);
            const dateStr = format(date, 'yyyy-MM-dd');
            const activityCount = activityMap[dateStr] || 0;
            const activityLevel = getActivityLevel(activityCount);
            
            return (
              <div
                key={date.toString()}
                className={`
                  aspect-square rounded-md flex items-center justify-center text-xs relative transition-all duration-150
                  ${activityLevel}
                  ${isTodayDate ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-white/50' : ''}
                `}
                title={`${format(date, 'MMM d, yyyy')} - ${activityCount} session(s)`}
              >
              </div>
            );
          })}
        </div>
        
        <div className="flex items-center justify-end gap-1 text-[10px] text-gray-500 pt-1">
          <span>Less</span>
          <div className="w-2 h-2 rounded-sm bg-gray-100"></div>
          <div className="w-2 h-2 rounded-sm bg-green-200"></div>
          <div className="w-2 h-2 rounded-sm bg-green-400"></div>
          <div className="w-2 h-2 rounded-sm bg-green-600"></div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}