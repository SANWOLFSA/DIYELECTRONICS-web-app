import { useState } from 'react';
import {
  GraduationCap,
  BookOpen,
  CheckCircle2,
  Award,
  Clock,
  Sparkles,
  Zap,
  RotateCcw,
  X,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { StudyCourse } from '../types';

interface ElectronicStudiesProps {
  courses: StudyCourse[];
  onCourseComplete?: (courseId: string, courseTitle: string) => void;
}

export default function ElectronicStudies({ courses, onCourseComplete }: ElectronicStudiesProps) {
  const [selectedCourse, setSelectedCourse] = useState<StudyCourse | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [passedCourses, setPassedCourses] = useState<string[]>(['course_1']);

  const handleStartCourse = (course: StudyCourse) => {
    setSelectedCourse(course);
    setSelectedAnswers({});
    setQuizSubmitted(false);
  };

  const handleSelectAnswer = (moduleId: string, optIdx: number) => {
    if (quizSubmitted) return;
    setSelectedAnswers({ ...selectedAnswers, [moduleId]: optIdx });
  };

  const handleGradeQuiz = () => {
    if (!selectedCourse) return;
    setQuizSubmitted(true);

    const quizModules = selectedCourse.modules.filter((m) => m.quizQuestion);
    let correctCount = 0;
    quizModules.forEach((m) => {
      if (m.quizQuestion && selectedAnswers[m.id] === m.quizQuestion.correctIndex) {
        correctCount++;
      }
    });

    const isPass = quizModules.length === 0 || correctCount / quizModules.length >= 0.5;
    if (isPass && !passedCourses.includes(selectedCourse.id)) {
      setPassedCourses([...passedCourses, selectedCourse.id]);
      if (onCourseComplete) {
        onCourseComplete(selectedCourse.id, selectedCourse.title);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-xs font-bold">
            <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
            <span>Electrical Engineering & Repair Curriculum</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
            Electronic Studies & Bench Certification
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
            For students in electrical courses and technicians advancing their skills. Learn schematic reading, SMD hot-air rework, and power negotiation with interactive quizzes.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-amber-400 text-stone-950 flex items-center gap-4 shrink-0 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-stone-950 text-amber-400 flex items-center justify-center font-black text-lg">
            {passedCourses.length}
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-900 block">
              Certificates Earned
            </span>
            <span className="text-xs font-black text-stone-950">
              {passedCourses.length} of {courses.length} Completed
            </span>
          </div>
        </div>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => {
          const isPassed = passedCourses.includes(course.id);

          return (
            <div
              key={course.id}
              className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                {/* Header Bar */}
                <div className="p-6 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/30 flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                      {course.category}
                    </span>
                    <h3 className="text-base font-black text-stone-900 dark:text-stone-100 mt-1">
                      {course.title}
                    </h3>
                  </div>

                  {isPassed && (
                    <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs" title="Certified">
                      <Award className="w-4 h-4" />
                    </span>
                  )}
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 text-xs text-stone-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      {course.durationHours} Hours
                    </span>
                    <span>•</span>
                    <span>{course.level} Level</span>
                  </div>

                  <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-3">
                    {course.description}
                  </p>

                  <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                      Curriculum Modules ({course.modules.length})
                    </span>
                    <div className="space-y-1.5">
                      {course.modules.map((m, idx) => (
                        <div
                          key={m.id || idx}
                          className="flex items-center justify-between text-xs text-stone-700 dark:text-stone-300 font-medium"
                        >
                          <span className="truncate max-w-[200px]">{idx + 1}. {m.title}</span>
                          <span className="text-[10px] text-stone-400 font-mono">{m.duration}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="p-6 pt-0">
                <button
                  onClick={() => handleStartCourse(course)}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                    isPassed
                      ? 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-200'
                      : 'bg-amber-400 hover:bg-amber-300 text-stone-950'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{isPassed ? 'Review Curriculum & Exam' : 'Start Course & Take Exam'}</span>
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Interactive Study & Exam Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-3xl max-h-[90vh] rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 sm:p-8 overflow-y-auto space-y-6 shadow-2xl">
            <button
              onClick={() => setSelectedCourse(null)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-400 text-stone-950 uppercase tracking-wider">
                {selectedCourse.category}
              </span>
              <h2 className="text-2xl font-black text-stone-900 dark:text-stone-100 mt-1">
                {selectedCourse.title}
              </h2>
              <p className="text-xs text-stone-500 mt-1">
                Instructor: <strong>{selectedCourse.instructor}</strong> • {selectedCourse.durationHours} Hours Total
              </p>
            </div>

            {/* Modules Overview */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Core Module Syllabus & Study Notes
              </h4>
              <div className="space-y-3">
                {selectedCourse.modules.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-stone-900 dark:text-stone-100">
                        Lesson {idx + 1}: {m.title}
                      </span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold">
                        {m.duration}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                      {m.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Module Quiz Questions */}
            <div className="space-y-4 pt-4 border-t border-stone-200 dark:border-stone-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Interactive Electrical Examination</span>
                </div>
                {quizSubmitted && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Grade Computed
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {selectedCourse.modules.filter((m) => m.quizQuestion).map((m, qIdx) => {
                  const q = m.quizQuestion!;
                  const userAns = selectedAnswers[m.id];
                  const isCorrect = userAns === q.correctIndex;

                  return (
                    <div
                      key={m.id}
                      className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-3"
                    >
                      <span className="font-bold text-xs text-stone-900 dark:text-stone-100 block">
                        Q{qIdx + 1}. {q.question}
                      </span>

                      <div className="space-y-1.5">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = userAns === optIdx;
                          let btnClass = 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700';

                          if (quizSubmitted) {
                            if (optIdx === q.correctIndex) {
                              btnClass = 'bg-emerald-100 dark:bg-emerald-950 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold';
                            } else if (isSelected && !isCorrect) {
                              btnClass = 'bg-red-100 dark:bg-red-950 border-red-500 text-red-800 dark:text-red-300';
                            }
                          } else if (isSelected) {
                            btnClass = 'bg-amber-400 text-stone-950 border-amber-500 font-bold';
                          }

                          return (
                            <button
                              key={optIdx}
                              onClick={() => handleSelectAnswer(m.id, optIdx)}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs border transition-all ${btnClass}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>

                      {quizSubmitted && (
                        <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-[11px] text-stone-600 dark:text-stone-400 space-y-0.5">
                          <strong className="text-stone-800 dark:text-stone-200">Explanation: </strong>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!quizSubmitted ? (
                <button
                  onClick={handleGradeQuiz}
                  className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs transition-colors shadow-xs"
                >
                  Grade My Exam & Bestow Certificate
                </button>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      setQuizSubmitted(false);
                      setSelectedAnswers({});
                    }}
                    className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs"
                  >
                    Retake Exam
                  </button>

                  <button
                    onClick={() => setSelectedCourse(null)}
                    className="px-5 py-2 rounded-xl bg-stone-950 text-white dark:bg-amber-400 dark:text-stone-950 font-bold text-xs"
                  >
                    Complete
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
