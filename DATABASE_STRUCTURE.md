# هيكلية قاعدة بيانات تطبيق مكتب المحامي (Supabase)

هذا الملف يحتوي على تفاصيل كاملة عن الجداول، الحقول، والعلاقات في قاعدة البيانات.

---

## 1. جدول الحسابات (profiles)
يخزن بيانات المستخدمين (المحامين والمساعدين).

| الحقل | النوع | الوصف |
| :--- | :--- | :--- |
| `id` | UUID | المعرف الفريد للمستخدم (مربوط بـ Auth) |
| `full_name` | Text | الاسم الكامل |
| `mobile_number` | Text | رقم الجوال |
| `role` | Text | الدور (admin أو user) |
| `is_approved` | Boolean | هل الحساب معتمد؟ |
| `is_active` | Boolean | هل الحساب نشط؟ |
| `lawyer_id` | UUID | معرف المحامي الرئيسي (في حال كان المساعد) |
| `permissions` | JSONB | صلاحيات المساعد |
| `subscription_start_date` | Timestamp | تاريخ بدء الاشتراك |
| `subscription_end_date` | Timestamp | تاريخ انتهاء الاشتراك |
| `mobile_verified` | Boolean | هل تم التحقق من الجوال؟ |
| `otp_code` | Text | رمز التحقق المؤقت |
| `otp_expires_at` | Timestamp | تاريخ انتهاء رمز التحقق |
| `created_at` | Timestamp | تاريخ الإنشاء |
| `updated_at` | Timestamp | تاريخ آخر تحديث |

---

## 2. جدول الموكلين (clients)
يخزن بيانات الموكلين التابعين لكل محامي.

| الحقل | النوع | الوصف |
| :--- | :--- | :--- |
| `id` | UUID | المعرف الفريد للموكل |
| `user_id` | UUID | معرف المحامي صاحب الموكل |
| `name` | Text | اسم الموكل |
| `contact_info` | Text | معلومات الاتصال |
| `updated_at` | Timestamp | تاريخ آخر تحديث |

---

## 3. جدول القضايا (cases)
يخزن القضايا المرتبطة بالموكلين.

| الحقل | النوع | الوصف |
| :--- | :--- | :--- |
| `id` | UUID | المعرف الفريد للقضية |
| `user_id` | UUID | معرف المحامي |
| `client_id` | UUID | معرف الموكل |
| `subject` | Text | موضوع القضية |
| `client_name` | Text | اسم الموكل (للعرض السريع) |
| `opponent_name` | Text | اسم الخصم |
| `fee_agreement` | Text | اتفاقية الأتعاب |
| `status` | Text | الحالة (active, closed, on_hold) |
| `updated_at` | Timestamp | تاريخ آخر تحديث |

---

## 4. جدول مراحل القضايا (stages)
يخزن المراحل المختلفة لكل قضية (مثلاً: بداية، استئناف، نقض).

| الحقل | النوع | الوصف |
| :--- | :--- | :--- |
| `id` | UUID | المعرف الفريد للمرحلة |
| `user_id` | UUID | معرف المحامي |
| `case_id` | UUID | معرف القضية |
| `court` | Text | المحكمة |
| `case_number` | Text | رقم الدعوى |
| `first_session_date` | Timestamp | تاريخ أول جلسة |
| `decision_date` | Timestamp | تاريخ الحكم |
| `decision_number` | Text | رقم الحكم |
| `decision_summary` | Text | خلاصة الحكم |
| `decision_notes` | Text | ملاحظات الحكم |
| `updated_at` | Timestamp | تاريخ آخر تحديث |

---

## 5. جدول الجلسات (sessions)
يخزن الجلسات المرتبطة بكل مرحلة من مراحل القضية.

| الحقل | النوع | الوصف |
| :--- | :--- | :--- |
| `id` | UUID | المعرف الفريد للجلسة |
| `user_id` | UUID | معرف المحامي |
| `stage_id` | UUID | معرف المرحلة |
| `court` | Text | المحكمة |
| `case_number` | Text | رقم الدعوى |
| `date` | Timestamp | تاريخ الجلسة |
| `client_name` | Text | اسم الموكل |
| `opponent_name` | Text | اسم الخصم |
| `postponement_reason` | Text | سبب التأجيل |
| `next_postponement_reason` | Text | سبب التأجيل القادم |
| `is_postponed` | Boolean | هل تم التأجيل؟ |
| `next_session_date` | Timestamp | تاريخ الجلسة القادمة |
| `assignee` | Text | المكلف بالجلسة |
| `updated_at` | Timestamp | تاريخ آخر تحديث |

---

## 6. جدول المهام الإدارية (admin_tasks)
يخزن المهام اليومية للمكتب.

| الحقل | النوع | الوصف |
| :--- | :--- | :--- |
| `id` | UUID | المعرف الفريد للمهمة |
| `user_id` | UUID | معرف المحامي |
| `task` | Text | وصف المهمة |
| `due_date` | Timestamp | تاريخ الاستحقاق |
| `completed` | Boolean | هل اكتملت؟ |
| `importance` | Text | الأهمية (normal, important, urgent) |
| `assignee` | Text | المكلف بالمهمة |
| `location` | Text | المكان |
| `order_index` | Integer | ترتيب المهمة |
| `updated_at` | Timestamp | تاريخ آخر تحديث |

---

## 7. جدول المواعيد (appointments)
يخزن المواعيد واللقاءات.

| الحقل | النوع | الوصف |
| :--- | :--- | :--- |
| `id` | UUID | المعرف الفريد للموعد |
| `user_id` | UUID | معرف المحامي |
| `title` | Text | عنوان الموعد |
| `time` | Text | وقت الموعد |
| `date` | Timestamp | تاريخ الموعد |
| `importance` | Text | الأهمية |
| `completed` | Boolean | هل اكتمل؟ |
| `reminder_time_in_minutes` | Integer | وقت التذكير بالدقائق |
| `assignee` | Text | المكلف بالموعد |
| `updated_at` | Timestamp | تاريخ آخر تحديث |

---

## 8. جدول القيود المحاسبية (accounting_entries)
يخزن الحركات المالية (دخل/مصاريف).

| الحقل | النوع | الوصف |
| :--- | :--- | :--- |
| `id` | UUID | المعرف الفريد للقيد |
| `user_id` | UUID | معرف المحامي |
| `type` | Text | النوع (income, expense) |
| `amount` | Numeric | المبلغ |
| `date` | Timestamp | تاريخ الحركة |
| `description` | Text | الوصف |
| `client_id` | UUID | معرف الموكل المرتبط |
| `case_id` | UUID | معرف القضية المرتبطة |
| `client_name` | Text | اسم الموكل |
| `updated_at` | Timestamp | تاريخ آخر تحديث |

---

## 9. جدول الفواتير (invoices)
يخزن الفواتير الصادرة للموكلين.

| الحقل | النوع | الوصف |
| :--- | :--- | :--- |
| `id` | Text | رقم الفاتورة (مثلاً INV-2024-001) |
| `user_id` | UUID | معرف المحامي |
| `client_id` | UUID | معرف الموكل |
| `client_name` | Text | اسم الموكل |
| `case_id` | UUID | معرف القضية |
| `case_subject` | Text | موضوع القضية |
| `issue_date` | Timestamp | تاريخ الإصدار |
| `due_date` | Timestamp | تاريخ الاستحقاق |
| `tax_rate` | Numeric | نسبة الضريبة |
| `discount` | Numeric | الخصم |
| `status` | Text | الحالة (draft, sent, paid, overdue) |
| `notes` | Text | ملاحظات |
| `updated_at` | Timestamp | تاريخ آخر تحديث |

---

## 10. جدول بنود الفواتير (invoice_items)
يخزن البنود التفصيلية لكل فاتورة.

| الحقل | النوع | الوصف |
| :--- | :--- | :--- |
| `id` | UUID | المعرف الفريد للبند |
| `user_id` | UUID | معرف المحامي |
| `invoice_id` | Text | معرف الفاتورة الأب |
| `description` | Text | وصف الخدمة |
| `amount` | Numeric | المبلغ |
| `updated_at` | Timestamp | تاريخ آخر تحديث |

---

## 11. جدول الوثائق (case_documents)
يخزن بيانات الملفات المرفوعة.

| الحقل | النوع | الوصف |
| :--- | :--- | :--- |
| `id` | UUID | المعرف الفريد للوثيقة |
| `user_id` | UUID | معرف المحامي |
| `case_id` | UUID | معرف القضية |
| `name` | Text | اسم الملف |
| `type` | Text | نوع الملف (MIME type) |
| `size` | Integer | حجم الملف بالبايت |
| `added_at` | Timestamp | تاريخ الإضافة |
| `storage_path` | Text | مسار الملف في Storage |
| `updated_at` | Timestamp | تاريخ آخر تحديث |

---

## 12. جدول المالية العامة للموقع (site_finances)
يخزن اشتراكات المستخدمين ومدفوعاتهم للموقع.

| الحقل | النوع | الوصف |
| :--- | :--- | :--- |
| `id` | Integer | المعرف الفريد |
| `user_id` | UUID | معرف المستخدم |
| `type` | Text | النوع (income, expense) |
| `payment_date` | Timestamp | تاريخ الدفع |
| `amount` | Numeric | المبلغ |
| `description` | Text | الوصف |
| `payment_method` | Text | طريقة الدفع |
| `category` | Text | الفئة |
| `updated_at` | Timestamp | تاريخ آخر تحديث |

---

## 13. جدول سجل الحذف (sync_deletions)
يستخدم لمزامنة عمليات الحذف بين الأجهزة والسحابة.

| الحقل | النوع | الوصف |
| :--- | :--- | :--- |
| `id` | Integer | المعرف الفريد |
| `table_name` | Text | اسم الجدول الذي تم الحذف منه |
| `record_id` | Text | معرف السجل المحذوف |
| `user_id` | UUID | معرف المستخدم الذي قام بالحذف |
| `deleted_at` | Timestamp | تاريخ الحذف |

---

## ملاحظات تقنية:
- جميع الجداول تحتوي على سياسات أمان (RLS) تضمن أن كل مستخدم يصل فقط لبياناته الخاصة أو بيانات المحامي الذي يعمل لديه.
- يتم استخدام حقل `updated_at` بشكل أساسي في عملية المزامنة (Sync) لتحديد التعديلات الأحدث.
- العلاقات بين الجداول تعتمد بشكل أساسي على معرفات الـ UUID.
