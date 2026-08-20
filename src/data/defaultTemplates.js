export const DEFAULT_TEMPLATES = [
  {
    id: 'intake-welcome',
    title: 'New Client Welcome & Intake Orientation',
    category: 'Intake & Orientation',
    description: 'Welcome new clients to therapy, provide telehealth links/office details, intake paperwork instructions, and emergency contacts.',
    icon: 'Sparkles',
    subject: 'Welcome to {{practice_name}} - Intake Information & Next Steps',
    body: `Dear {{client_name}},

Welcome to {{practice_name}}. I am pleased to have the opportunity to work with you on your therapeutic journey.

Our initial intake assessment is scheduled for {{intake_date}} at {{intake_time}}. {{session_modality_details}}

Prior to our first appointment, please complete the electronic intake paperwork, practice agreements, and background questionnaire through the client portal by {{paperwork_deadline}}.

A few important practice reminders:
• Confidentiality: Everything discussed in our sessions is strictly confidential in accordance with HIPAA and state licensing guidelines, subject to standard legal exceptions (such as imminent safety concerns).
• Cancellations: Please provide at least {{cancellation_notice_hours}} hours' notice for any cancellations or reschedules to avoid late fees.
• Communication: Non-urgent inquiries may be sent via secure portal message or email at {{practice_email}}.

Please note that our practice does not provide 24/7 crisis coverage. If you experience a mental health emergency, please dial 988 (Suicide & Crisis Lifeline), call 911, or go to your nearest emergency room.

I look forward to meeting with you and collaborating on your personal goals.

Warm regards,`,
    fields: [
      { name: 'client_name', label: 'Client Full Name', type: 'text', defaultValue: 'Alex Morgan' },
      { name: 'intake_date', label: 'Intake Date', type: 'date', defaultValue: '2026-08-25' },
      { name: 'intake_time', label: 'Intake Time', type: 'text', defaultValue: '2:00 PM EST' },
      { name: 'session_modality_details', label: 'Session Modality / Location', type: 'textarea', defaultValue: 'We will meet via our secure HIPAA-compliant telehealth platform. You may join the session directly at the scheduled time using this link: https://telehealth.example.com/room' },
      { name: 'paperwork_deadline', label: 'Paperwork Due Date', type: 'text', defaultValue: '24 hours prior to our session' },
      { name: 'cancellation_notice_hours', label: 'Cancellation Notice (Hours)', type: 'text', defaultValue: '24' },
      { name: 'practice_name', label: 'Practice Name', type: 'text', defaultValue: 'Hope Counseling & Wellness' },
      { name: 'practice_email', label: 'Practice Email', type: 'text', defaultValue: 'contact@example.com' }
    ]
  },
  {
    id: 'missed-session-1',
    title: 'First Missed Session Check-In',
    category: 'Attendance & Missed Sessions',
    description: 'Empathetic, supportive outreach after a first missed or unexcused absence to check safety and reschedule.',
    icon: 'CalendarX',
    subject: 'Checking In Regarding Our Missed Appointment - {{client_name}}',
    body: `Dear {{client_name}},

I am reaching out because we missed our scheduled therapy appointment today, {{missed_date}} at {{missed_time}}. 

I wanted to check in and make sure you are doing well and that you are safe. I understand that unforeseen emergencies, illnesses, and scheduling conflicts arise.

Consistency is an essential part of the therapeutic process. When you are able, please reach out to let me know you are alright and whether you would like to reschedule. 

My current upcoming availability includes:
• {{reschedule_option_1}}
• {{reschedule_option_2}}

If you prefer, you may also book directly through the client scheduling portal. Please reply by {{response_deadline}} to confirm your continued participation in therapy.

Looking forward to hearing from you.

Warmly,`,
    fields: [
      { name: 'client_name', label: 'Client Full Name', type: 'text', defaultValue: 'Jordan Reed' },
      { name: 'missed_date', label: 'Missed Session Date', type: 'date', defaultValue: '2026-08-19' },
      { name: 'missed_time', label: 'Missed Session Time', type: 'text', defaultValue: '11:00 AM' },
      { name: 'reschedule_option_1', label: 'Reschedule Option 1', type: 'text', defaultValue: 'Thursday, Aug 21 at 1:00 PM EST' },
      { name: 'reschedule_option_2', label: 'Reschedule Option 2', type: 'text', defaultValue: 'Monday, Aug 25 at 11:00 AM EST' },
      { name: 'response_deadline', label: 'Response Deadline', type: 'text', defaultValue: 'Friday, August 22nd' }
    ]
  },
  {
    id: 'missed-session-2',
    title: 'Second Missed Session / Engagement Notice',
    category: 'Attendance & Missed Sessions',
    description: 'Formal attendance notice after 2 consecutive missed sessions, outlining practice policy prior to administrative discharge.',
    icon: 'Clock',
    subject: 'Important: Therapy Attendance & Follow-up Notice - {{client_name}}',
    body: `Dear {{client_name}},

I am writing to follow up regarding our recent missed therapy appointments on {{missed_dates_list}}. I have attempted to reach you previously but have not received a response.

I hope you are safe and doing well. As shared during our intake, consistent attendance is vital to supporting your treatment goals and clinical progress.

In accordance with practice policy, if we do not hear from you by {{closure_deadline_date}} to reschedule or clarify your treatment intentions, I will assume that you wish to discontinue therapy at this time, and your file will be placed on administrative inactive status.

Should you wish to continue our work together, please reply to this email, message me in the portal, or call {{practice_phone}} as soon as possible.

If you are navigating a mental health crisis, please remember that 24/7 immediate assistance is available by calling or texting 988, or by texting HOME to 741741.

Sincerely,`,
    fields: [
      { name: 'client_name', label: 'Client Full Name', type: 'text', defaultValue: 'Taylor Brooks' },
      { name: 'missed_dates_list', label: 'Missed Dates List', type: 'text', defaultValue: 'August 5th and August 12th, 2026' },
      { name: 'closure_deadline_date', label: 'Response / Closure Deadline', type: 'date', defaultValue: '2026-08-29' },
      { name: 'practice_phone', label: 'Practice Phone', type: 'text', defaultValue: '(555) 019-2834' }
    ]
  },
  {
    id: 'missed-session-3-final',
    title: 'Third Missed Session / Final Administrative Discharge',
    category: 'Attendance & Missed Sessions',
    description: 'Formal closure notice after 3 unexcused absences, officially terminating therapeutic relationship with crisis resources.',
    icon: 'FileX',
    subject: 'Final Notice: Discontinuation of Therapy Services - {{client_name}}',
    body: `Dear {{client_name}},

This letter serves as formal notification that your outpatient psychotherapy case with {{practice_name}} has been officially closed due to three consecutive missed appointments on {{missed_dates_series}} without contact.

Because we have had no response to our prior outreach attempts, our professional therapeutic relationship is formally concluded as of today, {{effective_discharge_date}}.

If you need immediate mental health support or crisis intervention:
• National Suicide & Crisis Lifeline: Dial or text 988 (Available 24/7)
• The Crisis Text Line: Text HOME to 741741
• Emergency Medical Services: Dial 911 or visit your nearest hospital emergency department

Should you wish to seek therapy elsewhere in the future, you may consult:
• Psychology Today Directory (psychologytoday.com)
• Open Path Psychotherapy Collective (openpathcollective.org)
• NYC Well Support Services (1-888-NYC-WELL)

I wish you health, wellness, and peace in your journey ahead.

Sincerely,`,
    fields: [
      { name: 'client_name', label: 'Client Full Name', type: 'text', defaultValue: 'Devon Vance' },
      { name: 'practice_name', label: 'Practice Name', type: 'text', defaultValue: 'Hope Counseling & Wellness' },
      { name: 'missed_dates_series', label: 'Missed Dates Series', type: 'text', defaultValue: 'July 28, August 4, and August 11, 2026' },
      { name: 'effective_discharge_date', label: 'Effective Discharge Date', type: 'date', defaultValue: '2026-08-19' }
    ]
  },
  {
    id: 'discharge-successful',
    title: 'Treatment Completion & Successful Discharge',
    category: 'Discharge & Completion',
    description: 'Formal discharge summary celebrating goal achievement, reviewing coping tools, and providing aftercare instructions.',
    icon: 'Award',
    subject: 'Congratulations on Completing Therapy - Treatment Summary & Next Steps',
    body: `Dear {{client_name}},

Congratulations on completing your course of psychotherapy with {{practice_name}}. It has been a true privilege to work with you throughout this chapter of your growth and healing.

Over the course of our {{treatment_duration_months}} months of treatment (from {{start_date}} to {{discharge_date}}), you demonstrated remarkable commitment to your mental health. 

Summary of Treatment Progress & Mastered Coping Strategies:
{{progress_summary}}

As we transition to your maintenance phase, remember that growth is an ongoing journey with natural ebbs and flows. Should you ever wish to schedule a booster session, adjust your self-care plan, or re-engage in therapy in the future, my door remains open.

Recommended Aftercare & Wellness Resources:
• {{aftercare_resources}}

I wish you continued health, resilience, and fulfillment in all your endeavors.

With sincere respect and best wishes,`,
    fields: [
      { name: 'client_name', label: 'Client Full Name', type: 'text', defaultValue: 'Casey Vance' },
      { name: 'practice_name', label: 'Practice Name', type: 'text', defaultValue: 'Hope Counseling & Wellness' },
      { name: 'treatment_duration_months', label: 'Treatment Duration (Months)', type: 'text', defaultValue: '8' },
      { name: 'start_date', label: 'Treatment Start Date', type: 'date', defaultValue: '2025-12-01' },
      { name: 'discharge_date', label: 'Discharge Date', type: 'date', defaultValue: '2026-08-19' },
      { name: 'progress_summary', label: 'Progress & Coping Tools', type: 'textarea', defaultValue: '• Significant reduction in generalized anxiety and panic symptoms.\n• Implementation of cognitive reframing, somatic grounding, and boundary-setting techniques.\n• Developed a comprehensive crisis relapse prevention plan.' },
      { name: 'aftercare_resources', label: 'Aftercare & Wellness Recommendations', type: 'textarea', defaultValue: 'Daily mindfulness journaling, ongoing peer support groups, and annual mental health wellness check-ins.' }
    ]
  },
  {
    id: 'discharge-administrative',
    title: 'Administrative Case Closure (Loss of Contact)',
    category: 'Discharge & Completion',
    description: 'Formal termination letter closing clinical case due to extended lapse in contact, with crisis contacts and referral list.',
    icon: 'FileX',
    subject: 'Notice of Therapy Case Closure - {{client_name}}',
    body: `Dear {{client_name}},

This letter serves as formal notification that your therapy case with {{practice_name}} is being closed administratively as of {{effective_date}}, due to {{closure_reason}}.

Because there has been no contact since {{last_contact_date}}, our professional therapeutic relationship is now formally concluded.

If you decide to resume therapy in the future, you are welcome to contact me to discuss my current availability and schedule a new intake assessment. Alternatively, if you would prefer to connect with another mental health provider, below is a list of community referral resources:
{{community_referrals}}

Crisis & Immediate Support Resources:
• National Suicide & Crisis Lifeline: Call or text 988 (Available 24/7, free and confidential)
• The Crisis Text Line: Text HOME to 741741
• Emergency Services: Dial 911 or visit your local hospital emergency department

I wish you the very best in your health, wellness, and future endeavors.

Sincerely,`,
    fields: [
      { name: 'client_name', label: 'Client Full Name', type: 'text', defaultValue: 'Morgan Riley' },
      { name: 'practice_name', label: 'Practice Name', type: 'text', defaultValue: 'Hope Counseling & Wellness' },
      { name: 'effective_date', label: 'Effective Closure Date', type: 'date', defaultValue: '2026-08-19' },
      { name: 'closure_reason', label: 'Reason for Closure', type: 'text', defaultValue: 'an extended lapse in attendance and absence of response to outreach' },
      { name: 'last_contact_date', label: 'Last Contact Date', type: 'date', defaultValue: '2026-07-15' },
      { name: 'community_referrals', label: 'Community Referrals', type: 'textarea', defaultValue: '• Psychology Today Directory (psychologytoday.com/us/therapists)\n• NYC Well Mental Health Services (1-888-NYC-WELL / nycwell.cityofnewyork.us)\n• Open Path Psychotherapy Collective (openpathcollective.org)' }
    ]
  },
  {
    id: 'verification-attendance',
    title: 'Treatment & Attendance Verification',
    category: 'Medical & Verification',
    description: 'Standardized proof of therapy letter for employers, universities, courts, or insurance verification.',
    icon: 'FileCheck',
    subject: 'Psychotherapy Treatment & Attendance Verification - {{client_name}}',
    body: `To Whom It May Concern:

This letter serves to verify that {{client_name}} (DOB: {{client_dob}}) is currently an active client receiving outpatient mental health counseling at {{practice_name}}.

Treatment Verification Details:
• Date of Initial Intake: {{intake_date}}
• Session Frequency: {{session_frequency}}
• Total Sessions Attended: {{total_sessions_completed}}
• Most Recent Session Attended: {{most_recent_session_date}}
• Current Clinical Status: {{clinical_status}}

{{client_name}} has consistently participated in psychotherapy and adheres to all recommended treatment guidelines and scheduling commitments.

{{additional_clinical_statement}}

If you require any additional verification or documentation, please do not hesitate to contact my office at {{practice_phone}} or via email at {{practice_email}}.

Sincerely,`,
    fields: [
      { name: 'client_name', label: 'Client Full Name', type: 'text', defaultValue: 'Samira Patel' },
      { name: 'client_dob', label: 'Client Date of Birth', type: 'date', defaultValue: '1995-04-12' },
      { name: 'practice_name', label: 'Practice Name', type: 'text', defaultValue: 'Hope Counseling & Wellness' },
      { name: 'intake_date', label: 'Intake / Start Date', type: 'date', defaultValue: '2026-01-15' },
      { name: 'session_frequency', label: 'Session Frequency', type: 'text', defaultValue: 'Weekly 45-minute individual psychotherapy' },
      { name: 'total_sessions_completed', label: 'Total Sessions Completed', type: 'text', defaultValue: '28 sessions' },
      { name: 'most_recent_session_date', label: 'Most Recent Session', type: 'date', defaultValue: '2026-08-18' },
      { name: 'clinical_status', label: 'Clinical Status', type: 'text', defaultValue: 'In active treatment with good compliance and positive prognosis' },
      { name: 'additional_clinical_statement', label: 'Additional Statement (Optional)', type: 'textarea', defaultValue: 'The client is actively engaged in developing stress management and cognitive resilience strategies.' },
      { name: 'practice_phone', label: 'Practice Phone', type: 'text', defaultValue: '(555) 019-2834' },
      { name: 'practice_email', label: 'Practice Email', type: 'text', defaultValue: 'contact@example.com' }
    ]
  },
  {
    id: 'academic-accommodations',
    title: 'University / Academic Mental Health Accommodations',
    category: 'Medical & Verification',
    description: 'Formal documentation requesting university disability accommodations for mental health conditions.',
    icon: 'Sparkles',
    subject: 'Academic Accommodation Request - Re: {{client_name}}',
    body: `To the Office of Accessibility & Disability Services:

I am writing on behalf of my client, {{client_name}} (DOB: {{client_dob}}, Student ID: {{student_id}}), who is currently receiving outpatient mental health counseling under my professional care at {{practice_name}}.

Clinical Diagnostic Summary:
{{client_name}} has a diagnosed mental health condition (DSM-5: {{diagnostic_codes}}) that significantly impacts cognitive processing speed, executive functioning, and sustained attention during periods of acute psychological stress.

Recommended Academic Accommodations:
Based on my clinical evaluation, I recommend the following reasonable accommodations to ensure equal educational access:
{{recommended_accommodations_list}}

These accommodations are intended to mitigate the functional limitations of the student's clinical condition and support academic stabilization.

Please feel free to contact my office at {{practice_phone}} if you require additional verification.

Sincerely,`,
    fields: [
      { name: 'client_name', label: 'Student Full Name', type: 'text', defaultValue: 'Harper Collins' },
      { name: 'client_dob', label: 'Date of Birth', type: 'date', defaultValue: '2004-03-19' },
      { name: 'student_id', label: 'Student ID Number', type: 'text', defaultValue: 'STU-88219' },
      { name: 'practice_name', label: 'Practice Name', type: 'text', defaultValue: 'Hope Counseling & Wellness' },
      { name: 'diagnostic_codes', label: 'DSM-5 Diagnostic Codes', type: 'text', defaultValue: 'F41.1 (Generalized Anxiety Disorder), F32.1 (Major Depressive Disorder, Single Episode, Moderate)' },
      { name: 'recommended_accommodations_list', label: 'Accommodations List', type: 'textarea', defaultValue: '• 1.5x (50% extended) time on all timed quizzes, exams, and midterms/finals.\n• Distraction-reduced, quiet examination environment.\n• Permission for brief 5-minute sensory breaks during extended lectures.\n• Flexible attendance policy with allowance for up to 3 excused medical absences per semester.' },
      { name: 'practice_phone', label: 'Practice Phone', type: 'text', defaultValue: '(555) 019-2834' }
    ]
  },
  {
    id: 'court-compliance',
    title: 'Court / Probation Treatment Compliance Letter',
    category: 'Legal & Court',
    description: 'Standardized clinical verification for court, attorney, or probation officer confirming therapy compliance.',
    icon: 'FileCheck',
    subject: 'Mental Health Treatment Compliance Verification - {{client_name}}',
    body: `To the Honorable Court / Probation Department:

Re: {{client_name}} (DOB: {{client_dob}}, Case/Docket #: {{court_case_number}})

This letter serves to confirm that {{client_name}} is currently engaged in outpatient mental health counseling with {{practice_name}} pursuant to {{treatment_mandate_reason}}.

Compliance Summary:
• Date of Intake Assessment: {{intake_date}}
• Required Attendance Frequency: {{session_frequency}}
• Total Sessions Attended to Date: {{sessions_attended_count}}
• Unexcused Absences: {{unexcused_absence_count}}
• Most Recent Session Attended: {{last_session_date}}
• Next Scheduled Session: {{next_scheduled_session_date}}

Compliance Statement:
{{client_name}} has attended all scheduled sessions in a punctual manner, demonstrates active engagement in treatment, and is currently in full compliance with all clinical counseling requirements.

Should the Court or Probation Department require updated compliance reports, my office may be reached at {{practice_phone}}.

Respectfully submitted,`,
    fields: [
      { name: 'client_name', label: 'Client Full Name', type: 'text', defaultValue: 'Marcus Sterling' },
      { name: 'client_dob', label: 'Date of Birth', type: 'date', defaultValue: '1987-10-14' },
      { name: 'court_case_number', label: 'Docket / Case Number', type: 'text', defaultValue: 'CR-2026-4491-NY' },
      { name: 'practice_name', label: 'Practice Name', type: 'text', defaultValue: 'Hope Counseling & Wellness' },
      { name: 'treatment_mandate_reason', label: 'Treatment Context', type: 'text', defaultValue: 'court-ordered behavioral health counseling' },
      { name: 'intake_date', label: 'Intake Date', type: 'date', defaultValue: '2026-02-10' },
      { name: 'session_frequency', label: 'Session Frequency', type: 'text', defaultValue: 'Bi-weekly individual psychotherapy sessions' },
      { name: 'sessions_attended_count', label: 'Sessions Attended Count', type: 'text', defaultValue: '14 sessions' },
      { name: 'unexcused_absence_count', label: 'Unexcused Absences', type: 'text', defaultValue: '0' },
      { name: 'last_session_date', label: 'Last Session Date', type: 'date', defaultValue: '2026-08-17' },
      { name: 'next_scheduled_session_date', label: 'Next Scheduled Session', type: 'date', defaultValue: '2026-08-31' },
      { name: 'practice_phone', label: 'Practice Phone', type: 'text', defaultValue: '(555) 019-2834' }
    ]
  },
  {
    id: 'sliding-scale-agreement',
    title: 'Sliding Scale & Financial Hardship Fee Agreement',
    category: 'Administrative & Billing',
    description: 'Formal clinical fee adjustment agreement for clients experiencing temporary financial hardship.',
    icon: 'Receipt',
    subject: 'Sliding Scale Fee Agreement & Review Schedule - {{client_name}}',
    body: `Dear {{client_name}},

This document formalizes our agreed-upon sliding scale fee arrangement for outpatient psychotherapy services with {{practice_name}}.

Fee & Financial Agreement Details:
• Standard Full Practice Fee: {{standard_practice_fee}} per session
• Adjusted Sliding Scale Fee: {{adjusted_fee_per_session}} per session
• Effective Start Date: {{fee_agreement_start_date}}
• Fee Agreement Review Date: {{fee_review_date}}

Terms and Conditions:
1. The adjusted fee of {{adjusted_fee_per_session}} applies to all individual 45-minute psychotherapy sessions (CPT 90834) during the agreed-upon period.
2. Payment is due at the time each session is rendered via credit card on file or electronic portal transfer.
3. This financial adjustment is granted based on temporary financial circumstances and will be re-evaluated on {{fee_review_date}}.

Please sign and return a copy of this agreement to confirm your understanding and acceptance of these financial terms.

Sincerely,`,
    fields: [
      { name: 'client_name', label: 'Client Full Name', type: 'text', defaultValue: 'Kendall Woods' },
      { name: 'practice_name', label: 'Practice Name', type: 'text', defaultValue: 'Hope Counseling & Wellness' },
      { name: 'standard_practice_fee', label: 'Standard Practice Fee', type: 'text', defaultValue: '$175.00' },
      { name: 'adjusted_fee_per_session', label: 'Adjusted Fee Per Session', type: 'text', defaultValue: '$95.00' },
      { name: 'fee_agreement_start_date', label: 'Agreement Start Date', type: 'date', defaultValue: '2026-08-01' },
      { name: 'fee_review_date', label: 'Re-evaluation Date (6 Months)', type: 'date', defaultValue: '2027-02-01' }
    ]
  },
  {
    id: 'referral-pcp-psychiatry',
    title: 'PCP / Psychiatric Care Coordination & Referral',
    category: 'Referrals & Coordination',
    description: 'Clinical consultation note sharing diagnosis, treatment progress, and recommending medication evaluation.',
    icon: 'Stethoscope',
    subject: 'Care Coordination & Clinical Consultation - Re: {{client_name}}',
    body: `Dear Dr. {{provider_last_name}},

I am writing with the written consent of our mutual patient, {{client_name}} (DOB: {{client_dob}}), to coordinate clinical care and provide an update on their outpatient psychotherapy progress.

{{client_name}} has been in weekly individual psychotherapy with me since {{start_date}} for treatment of {{primary_clinical_concerns}} (Diagnostic Impression: {{diagnostic_codes}}).

Clinical Summary & Treatment Observations:
{{clinical_observations}}

Reason for Consultation / Collaborative Request:
{{reason_for_consult}}

I welcome the opportunity to coordinate care with your office to optimize {{client_name}}'s treatment outcomes. Please feel free to contact me directly at {{practice_phone}} or via secure email at {{practice_email}}.

Thank you for your collaboration and dedicated care.

Warm regards,`,
    fields: [
      { name: 'provider_last_name', label: 'Provider Name / Dr. Last Name', type: 'text', defaultValue: 'Chen' },
      { name: 'client_name', label: 'Client Full Name', type: 'text', defaultValue: 'Eliot Hayes' },
      { name: 'client_dob', label: 'Client Date of Birth', type: 'date', defaultValue: '1991-11-03' },
      { name: 'start_date', label: 'Treatment Start Date', type: 'date', defaultValue: '2026-03-10' },
      { name: 'primary_clinical_concerns', label: 'Primary Concerns', type: 'text', defaultValue: 'Major Depressive Disorder and Generalized Anxiety' },
      { name: 'diagnostic_codes', label: 'Diagnostic Impression / DSM-5', type: 'text', defaultValue: 'F33.1 (MDD, Recurrent, Moderate), F41.1 (GAD)' },
      { name: 'clinical_observations', label: 'Clinical Observations', type: 'textarea', defaultValue: 'The patient has engaged consistently in CBT and mindfulness-based interventions. While sleep hygiene and behavioral activation have yielded modest improvements, the patient continues to experience significant vegetative depressive symptoms, psychomotor slowing, and persistent anxiety.' },
      { name: 'reason_for_consult', label: 'Reason for Consult', type: 'textarea', defaultValue: 'I am referring the patient for a comprehensive psychiatric evaluation to explore pharmacotherapy options as an adjunct to ongoing psychotherapy.' },
      { name: 'practice_phone', label: 'Practice Phone', type: 'text', defaultValue: '(555) 019-2834' },
      { name: 'practice_email', label: 'Practice Email', type: 'text', defaultValue: 'contact@example.com' }
    ]
  },
  {
    id: 'medical-leave-fmla',
    title: 'Medical Leave of Absence / FMLA Recommendation',
    category: 'Medical & Verification',
    description: 'Clinical documentation recommending medical leave or modified duties to support mental health recovery.',
    icon: 'Heart',
    subject: 'Mental Health Medical Leave of Absence Recommendation - {{client_name}}',
    body: `To Whom It May Concern:

I am writing on behalf of my client, {{client_name}} (DOB: {{client_dob}}), who is under my active clinical care for a diagnosed mental health condition that substantially impacts their daily functioning and occupational capacity.

Clinical Determination & Leave Recommendation:
Due to the acute severity of {{client_name}}'s current clinical symptoms, it is my professional opinion that a temporary medical leave of absence is clinically necessary to allow for intensive therapeutic stabilization and recovery.

Recommended Leave Parameters:
• Leave Commencing: {{leave_start_date}}
• Estimated Return to Work Date: {{leave_end_date}}
• Leave Type: {{leave_type}}
• Re-evaluation Scheduled For: {{reevaluation_date}}

{{workplace_accommodations_text}}

This leave is vital to facilitating therapeutic recovery and preventing further clinical decompensation. Please provide all necessary employer/academic leave documentation directly to the patient.

Should you have any questions regarding this clinical recommendation, you may contact my office at {{practice_phone}}.

Sincerely,`,
    fields: [
      { name: 'client_name', label: 'Client Full Name', type: 'text', defaultValue: 'Avery Bennett' },
      { name: 'client_dob', label: 'Client Date of Birth', type: 'date', defaultValue: '1988-09-27' },
      { name: 'leave_start_date', label: 'Leave Start Date', type: 'date', defaultValue: '2026-08-25' },
      { name: 'leave_end_date', label: 'Estimated Return Date', type: 'date', defaultValue: '2026-10-06' },
      { name: 'leave_type', label: 'Leave Type', type: 'text', defaultValue: 'Continuous Full-Time Medical Leave (6 Weeks)' },
      { name: 'reevaluation_date', label: 'Clinical Re-evaluation Date', type: 'date', defaultValue: '2026-09-22' },
      { name: 'workplace_accommodations_text', label: 'Accommodations / Transition Plan', type: 'textarea', defaultValue: 'Upon return, a phased gradual resumption of duties (e.g., 3 days/week remote for the initial 2 weeks) is recommended to ensure sustained clinical stability.' },
      { name: 'practice_phone', label: 'Practice Phone', type: 'text', defaultValue: '(555) 019-2834' }
    ]
  },
  {
    id: 'bereavement-grief-support',
    title: 'Bereavement & Acute Grief Support Letter',
    category: 'Medical & Verification',
    description: 'Clinical justification letter supporting emergency bereavement leave and compassionate workplace flexibility.',
    icon: 'Heart',
    subject: 'Clinical Support for Bereavement Leave - {{client_name}}',
    body: `To Whom It May Concern:

I am writing on behalf of my client, {{client_name}} (DOB: {{client_dob}}), who is currently receiving outpatient psychotherapy under my care at {{practice_name}}.

{{client_name}} is currently processing an acute significant bereavement following {{bereavement_context}}.

Clinical Assessment & Recommendation:
The acute psychological distress, profound sleep disruption, and emotional impact associated with this bereavement significantly impair the client's current cognitive functioning and capacity to perform customary work responsibilities safely and effectively.

Recommended Leave Parameters:
• Recommended Bereavement Leave Duration: {{bereavement_leave_duration}}
• Effective Dates: From {{leave_commence_date}} through {{leave_conclude_date}}
• Recommended Return Support: {{return_support_recommendations}}

Allowing dedicated space for acute grief stabilization is clinically essential. Please grant {{client_name}} the requested compassionate leave without penalty.

Sincerely,`,
    fields: [
      { name: 'client_name', label: 'Client Full Name', type: 'text', defaultValue: 'Jordan Lee' },
      { name: 'client_dob', label: 'Date of Birth', type: 'date', defaultValue: '1992-06-18' },
      { name: 'practice_name', label: 'Practice Name', type: 'text', defaultValue: 'Hope Counseling & Wellness' },
      { name: 'bereavement_context', label: 'Loss / Context', type: 'text', defaultValue: 'the unexpected death of an immediate family member' },
      { name: 'bereavement_leave_duration', label: 'Recommended Leave Duration', type: 'text', defaultValue: '2 consecutive weeks of full-time compassionate leave' },
      { name: 'leave_commence_date', label: 'Leave Start Date', type: 'date', defaultValue: '2026-08-20' },
      { name: 'leave_conclude_date', label: 'Leave End Date', type: 'date', defaultValue: '2026-09-03' },
      { name: 'return_support_recommendations', label: 'Return Recommendations', type: 'textarea', defaultValue: 'A flexible hybrid schedule for the first week of return with reduced public-facing workload.' }
    ]
  },
  {
    id: 'esa-housing-letter',
    title: 'Emotional Support Animal (ESA) Verification',
    category: 'Medical & Verification',
    description: 'Housing accommodation recommendation pursuant to the Fair Housing Act confirming functional need for an ESA.',
    icon: 'ShieldCheck',
    subject: 'Emotional Support Animal (ESA) Housing Accommodation - {{client_name}}',
    body: `To Housing Provider / Property Management:

I am writing this letter in support of {{client_name}}'s (DOB: {{client_dob}}) request for a reasonable accommodation for an Emotional Support Animal (ESA) in accordance with the Fair Housing Act (42 U.S.C. § 3601 et seq.).

I am a Licensed Mental Health Counselor in the State of New York (License #000000), and {{client_name}} is an active client receiving ongoing psychotherapy under my professional care since {{treatment_start_date}}.

Clinical Determination:
{{client_name}} has a diagnosed mental health condition that meets the statutory definition of a disability under the Fair Housing Act. This condition substantially limits one or more major life activities, including sleep, emotional regulation, and managing acute distress.

I have clinically evaluated the relationship between the client's condition and the presence of their emotional support animal, {{animal_name_and_species}}. It is my professional opinion that the presence of this animal provides essential emotional grounding, ameliorates the functional limitations of the client's disability, and is necessary to allow equal opportunity to use and enjoy their dwelling.

Please grant {{client_name}}'s request for reasonable accommodation without unreasonable delay or imposition of pet fees/restrictions.

Sincerely,`,
    fields: [
      { name: 'client_name', label: 'Client Full Name', type: 'text', defaultValue: 'Riley Harper' },
      { name: 'client_dob', label: 'Client Date of Birth', type: 'date', defaultValue: '1998-02-14' },
      { name: 'treatment_start_date', label: 'Treatment Start Date', type: 'date', defaultValue: '2025-10-01' },
      { name: 'animal_name_and_species', label: 'Animal Name & Breed/Species', type: 'text', defaultValue: 'a 3-year-old Golden Retriever named "Oliver"' }
    ]
  },
  {
    id: 'good-faith-estimate',
    title: 'Good Faith Estimate & Superbill Notice',
    category: 'Administrative & Billing',
    description: 'Formal cost disclosure compliant with the No Surprises Act detailing session fees and CPT codes.',
    icon: 'Receipt',
    subject: 'Good Faith Estimate for Mental Health Services - {{client_name}}',
    body: `Dear {{client_name}},

Under Section 2799B-6 of the Public Health Service Act and the No Surprises Act, health care providers are required to provide self-pay or uninsured patients with a "Good Faith Estimate" of the total expected cost of non-emergency medical and mental health items and services.

Patient Information:
• Patient Name: {{client_name}} (DOB: {{client_dob}})
• Primary Clinical Service: {{service_description}}
• Service Location: {{service_location}}

Itemized Cost Schedule:
• CPT Code: {{cpt_code}} ({{session_duration}} Minutes)
• Fee Per Session: {{fee_per_session}}
• Estimated Session Frequency: {{estimated_frequency}}
• Estimated Total Cost for 12-Month Period: {{total_annual_estimate}}

Important Disclaimers:
1. This Good Faith Estimate shows the costs of items and services that are reasonably expected for your health care needs. The estimate is based on information known at the time the estimate was created.
2. Actual total costs may vary depending on your individualized clinical progress and agreed-upon frequency of care.
3. You have the right to initiate a dispute resolution process if the actual billed charges substantially exceed this estimate.

If you have questions regarding this estimate, please reach out directly to my office.

Sincerely,`,
    fields: [
      { name: 'client_name', label: 'Client Full Name', type: 'text', defaultValue: 'Devon Miller' },
      { name: 'client_dob', label: 'Client Date of Birth', type: 'date', defaultValue: '1993-07-29' },
      { name: 'service_description', label: 'Service Description', type: 'text', defaultValue: 'Individual Outpatient Psychotherapy' },
      { name: 'service_location', label: 'Service Location', type: 'text', defaultValue: 'Telehealth (New York)' },
      { name: 'cpt_code', label: 'CPT Code', type: 'text', defaultValue: '90834 (45-Minute Psychotherapy)' },
      { name: 'session_duration', label: 'Session Duration (Minutes)', type: 'text', defaultValue: '45' },
      { name: 'fee_per_session', label: 'Fee Per Session', type: 'text', defaultValue: '$175.00' },
      { name: 'estimated_frequency', label: 'Estimated Frequency', type: 'text', defaultValue: 'Weekly (approx. 40 sessions/year)' },
      { name: 'total_annual_estimate', label: 'Total Annual Estimate', type: 'text', defaultValue: '$7,000.00' }
    ]
  }
];

export const TEMPLATE_CATEGORIES = [
  'All',
  'Intake & Orientation',
  'Attendance & Missed Sessions',
  'Discharge & Completion',
  'Medical & Verification',
  'Referrals & Coordination',
  'Legal & Court',
  'Administrative & Billing'
];
