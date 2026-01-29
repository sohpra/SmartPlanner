import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { SUBJECTS } from "@shared/schema";
import { useCreateExam, useUpdateExam } from "@/hooks/use-exams";
import { useToast } from "@/hooks/use-toast";
import type { Exam } from "@shared/schema";
import { CalendarIcon, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const topicSchema = z.object({
  name: z.string().min(1, "Topic name is required"),
  difficulty: z.number().min(0).max(100),
});

const formSchema = z.object({
  examType: z.enum(["Internal", "Board", "Competitive"]),
  subject: z.string().optional(),
  competitiveExamName: z.string().optional(),
  examBoard: z.string().optional(),
  date: z.date({ required_error: "A date is required" }),
  color: z.string(),
  preparedness: z.number().min(0).max(100).optional(),
  topics: z.array(topicSchema).optional(),
}).superRefine((data, ctx) => {
  if (data.examType === "Internal") {
    if (!data.subject) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Subject is required for Internal exams", path: ["subject"] });
    }
    if (!data.topics || data.topics.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one topic is required for Internal exams", path: ["topics"] });
    }
  }
  if (data.examType === "Board") {
    if (!data.subject) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Subject is required for Board exams", path: ["subject"] });
    }
    if (data.preparedness === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Preparedness is required for Board exams", path: ["preparedness"] });
    }
  }
  if (data.examType === "Competitive") {
    if (!data.competitiveExamName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Exam name is required for Competitive exams", path: ["competitiveExamName"] });
    }
  }
});

type FormValues = z.infer<typeof formSchema>;

interface ExamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam?: Exam | null;
}

export function ExamDialog({ open, onOpenChange, exam }: ExamDialogProps) {
  const { toast } = useToast();
  const createExam = useCreateExam();
  const updateExam = useUpdateExam();
  const [topics, setTopics] = useState<{ name: string; difficulty: number }[]>([]);
  const [newTopicName, setNewTopicName] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      examType: "Internal",
      subject: "",
      competitiveExamName: "",
      examBoard: "",
      color: "#3b82f6",
      preparedness: 50,
      topics: [],
    },
  });

  const examType = form.watch("examType");

  useEffect(() => {
    if (exam) {
      const examTopics = (exam.topics as { name: string; difficulty: number }[]) || [];
      setTopics(examTopics);
      form.reset({
        examType: exam.examType as "Internal" | "Board" | "Competitive",
        subject: exam.subject || "",
        competitiveExamName: exam.competitiveExamName || "",
        examBoard: exam.examBoard || "",
        date: new Date(exam.date),
        color: exam.color,
        preparedness: exam.preparedness || 50,
        topics: examTopics,
      });
    } else {
      setTopics([]);
      form.reset({
        examType: "Internal",
        subject: "",
        competitiveExamName: "",
        examBoard: "",
        color: "#3b82f6",
        preparedness: 50,
        topics: [],
      });
    }
  }, [exam, form, open]);

  useEffect(() => {
    form.setValue("topics", topics);
  }, [topics, form]);

  const addTopic = () => {
    if (newTopicName.trim()) {
      setTopics([...topics, { name: newTopicName.trim(), difficulty: 50 }]);
      setNewTopicName("");
    }
  };

  const removeTopic = (index: number) => {
    setTopics(topics.filter((_, i) => i !== index));
  };

  const updateTopicDifficulty = (index: number, difficulty: number) => {
    const updated = [...topics];
    updated[index].difficulty = difficulty;
    setTopics(updated);
  };

  const isPending = createExam.isPending || updateExam.isPending;

  async function onSubmit(values: FormValues) {
    try {
      const payload = {
        ...values,
        subject: values.examType === "Competitive" ? null : values.subject,
        competitiveExamName: values.examType === "Competitive" ? values.competitiveExamName : null,
        topics: values.examType === "Internal" ? topics : null,
        preparedness: values.examType === "Board" ? values.preparedness : null,
      };

      if (exam) {
        await updateExam.mutateAsync({ id: exam.id, ...payload });
        toast({ title: "Success", description: "Exam updated successfully." });
      } else {
        await createExam.mutateAsync(payload);
        toast({ title: "Success", description: "Exam created successfully." });
      }
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{exam ? "Edit Exam" : "Add New Exam"}</DialogTitle>
          <DialogDescription>
            {exam ? "Update the exam details below." : "Fill in the details to add a new exam."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="examType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exam Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-exam-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Internal">Internal</SelectItem>
                      <SelectItem value="Board">Board</SelectItem>
                      <SelectItem value="Competitive">Competitive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {examType === "Competitive" && (
              <FormField
                control={form.control}
                name="competitiveExamName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exam Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Math Olympiad, SAT, etc."
                        {...field}
                        value={field.value || ""}
                        data-testid="input-competitive-exam-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {examType !== "Competitive" && (
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-subject">
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SUBJECTS.map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {examType === "Board" && (
              <>
                <FormField
                  control={form.control}
                  name="examBoard"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exam Board (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., AQA, OCR, Edexcel..."
                          {...field}
                          value={field.value || ""}
                          data-testid="input-exam-board"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="preparedness"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Preparedness Level: {field.value}%
                      </FormLabel>
                      <FormControl>
                        <Slider
                          value={[field.value || 50]}
                          onValueChange={(val) => field.onChange(val[0])}
                          max={100}
                          step={1}
                          className="py-4"
                          data-testid="slider-preparedness"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {examType === "Internal" && (
              <div className="space-y-3">
                <FormLabel>Topics (at least 1 required)</FormLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="Topic name"
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTopic();
                      }
                    }}
                    data-testid="input-topic-name"
                  />
                  <Button type="button" size="icon" onClick={addTopic} data-testid="button-add-topic">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {topics.length > 0 && (
                  <div className="space-y-3 mt-3">
                    {topics.map((topic, index) => (
                      <div key={index} className="p-3 border rounded-md bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{topic.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTopic(index)}
                            data-testid={`button-remove-topic-${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">Difficulty:</span>
                          <Slider
                            value={[topic.difficulty]}
                            onValueChange={(val) => updateTopicDifficulty(index, val[0])}
                            max={100}
                            step={1}
                            className="flex-1"
                            data-testid={`slider-topic-difficulty-${index}`}
                          />
                          <span className="text-xs font-medium w-8">{topic.difficulty}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {form.formState.errors.topics && (
                  <p className="text-sm text-destructive">{form.formState.errors.topics.message}</p>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of Exam</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid="button-date-picker"
                        >
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color Tag</FormLabel>
                  <div className="flex gap-2 flex-wrap">
                    {["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"].map((color) => (
                      <div
                        key={color}
                        onClick={() => field.onChange(color)}
                        className={cn(
                          "w-8 h-8 rounded-full cursor-pointer transition-transform hover:scale-110 ring-2 ring-offset-2",
                          field.value === color ? "ring-gray-400 scale-110" : "ring-transparent"
                        )}
                        style={{ backgroundColor: color }}
                        data-testid={`color-option-${color}`}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit-exam">
                {isPending ? "Saving..." : exam ? "Update Exam" : "Create Exam"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
